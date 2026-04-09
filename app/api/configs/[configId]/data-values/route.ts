import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUserId } from '@/lib/utils/auth'

// Define our own interfaces for the data values based on the schema
interface MessageDataValue {
  id: string;
  messageId: string;
  roundId: string | null;
  name: string;
  dataType: string;
  value: any;
  createdAt: Date;
  message?: {
    content: any;
    agentId?: string;
    metadata?: any;
    annotations?: any[];
    chatId?: string;
  };
}

interface AgentDetail {
  id: string;
  name: string;
  role?: string;
  avatar?: string;
}

interface MessagePreview {
  content: any;
  agentId?: string;
  agent?: AgentDetail;
}

interface DataValueResponse extends Omit<MessageDataValue, 'message'> {
  message?: MessagePreview;
  batchId?: string | null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ configId: string }> }
) {
  console.log('Starting config-level data-values GET request');
  try {
    // Log params
    const resolvedParams = await params;
    console.log('Request params:', resolvedParams);
    
    // Validate user authentication and get internal UUID
    console.log('Authenticating user');
    const userId = await getAuthenticatedUserId();
    console.log('Auth userId:', userId ? 'Found' : 'Not found');

    // Get configId from params
    const { configId } = resolvedParams;
    console.log(`Processing request for configId: ${configId}`);
    
    // userId is now the internal UUID from getAuthenticatedUserId()
    console.log('User ID:', userId);
    
    // Verify the config belongs to the user
    console.log('Verifying config ownership');
    const config = await prisma.config.findUnique({
      where: {
        id: configId,
        userId: userId
      }
    });
    
    console.log('Config:', config ? 'Found' : 'Not found');
    if (!config) {
      console.log('Config not found or not owned by user');
      return NextResponse.json(
        { error: 'Config not found or access denied' },
        { status: 404 }
      );
    }

    // First get all rounds for this config to ensure we only get data for rounds in this config
    console.log('Fetching rounds for config');
    const rounds = await prisma.chatRound.findMany({
      where: { configId },
      select: { id: true }
    });
    
    const roundIds = rounds.map(round => round.id);
    console.log(`Found ${roundIds.length} rounds for this config`);
    
    if (roundIds.length === 0) {
      console.log('No rounds found for this config');
      return NextResponse.json([]);
    }
    
    // Fetch the message data values for all rounds in this config with message info
    console.log('Fetching message data values with Prisma query');
    
    let dataValues: MessageDataValue[] = [];
    
    try {
      console.log('Executing Prisma query...');
      
      // Use a standard Prisma query with type assertion to bypass TypeScript error
      // The model exists at runtime but TypeScript doesn't recognize it
      dataValues = await (prisma as any).MessageDataValue.findMany({
        where: {
          roundId: {
            in: roundIds
          }
        },
        include: {
          message: {
            select: {
              content: true,
              agentId: true,
              metadata: true,
              chatId: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      console.log('Prisma query completed successfully');
      
      // Log some details about the messages to debug
      console.log(`First message details (if any):`, 
        dataValues.length > 0 ? 
        JSON.stringify({
          messageId: dataValues[0].messageId,
          agentId: dataValues[0].message?.agentId,
          hasMetadata: !!dataValues[0].message?.metadata,
          chatId: dataValues[0].message?.chatId
        }) : 'No messages');
      
    } catch (err) {
      // Log error safely
      console.log('Prisma query error occurred');
      console.log('Error type:', err ? (typeof err) : 'null or undefined');
      console.log('Error message:', err instanceof Error ? err.message : 'No error message available');
      
      // Return a proper error response
      return NextResponse.json(
        { error: 'Database query failed', details: err instanceof Error ? err.message : 'Unknown database error' },
        { status: 500 }
      );
    }
    
    console.log(`Query returned ${dataValues.length} data values`);
    
    // Format the query results into the expected structure
    try {
      console.log('Formatting data values');
      
      // Extract agent IDs from direct agentId field and message metadata
      const agentIds: string[] = [];
      const chatIds: string[] = [];
      
      dataValues.forEach(item => {
        // Check direct agentId field
        if (item.message?.agentId) {
          agentIds.push(item.message.agentId);
        }
        
        // Collect chatIds for batch lookup
        if (item.message?.chatId) {
          chatIds.push(item.message.chatId);
        }
        
        // Check metadata
        if (item.message?.metadata && typeof item.message.metadata === 'object') {
          const metadata = item.message.metadata;
          if (metadata.agentId) {
            agentIds.push(metadata.agentId);
          }
          if (metadata.agent?.id) {
            agentIds.push(metadata.agent.id);
          }
        }
      });
      
      const uniqueAgentIds = [...new Set(agentIds)].filter(id => id);
      const uniqueChatIds = [...new Set(chatIds)].filter(id => id);
      
      console.log(`Found ${uniqueAgentIds.length} unique agent IDs to look up from combined sources`);
      console.log(`Found ${uniqueChatIds.length} unique chat IDs to look up for batch information`);
      
      let agentMap = new Map<string, AgentDetail>();
      
      if (uniqueAgentIds.length > 0) {
        const agents = await prisma.chatAgent.findMany({
          where: {
            id: {
              in: uniqueAgentIds as string[]
            }
          },
          select: {
            id: true,
            name: true,
            role: true,
            avatar: true
          }
        });
        
        console.log(`Found ${agents.length} agents in the database`);
        
        agentMap = new Map(agents.map(agent => [
          agent.id, 
          { 
            id: agent.id, 
            name: agent.name, 
            role: agent.role,
            avatar: agent.avatar?.substring(0, 50) // Truncate SVG for performance
          }
        ]));
      }
      
      // Create a map of chatId to batchId
      let chatToBatchMap = new Map<string, string>();
      
      if (uniqueChatIds.length > 0) {
        const batchChats = await prisma.batchChat.findMany({
          where: {
            chatId: {
              in: uniqueChatIds
            }
          },
          select: {
            chatId: true,
            batchId: true
          }
        });
        
        console.log(`Found ${batchChats.length} batch chats for lookup`);
        
        chatToBatchMap = new Map(batchChats.map(bc => [bc.chatId, bc.batchId]));
      }
      
      // When creating the formatted data values, include the batchId
      const formattedDataValues: DataValueResponse[] = dataValues.map((item) => {
        // Extract agent ID from multiple sources
        let agentId = item.message?.agentId;
        let agentDetail: AgentDetail | undefined;
        
        // If direct agentId is missing, try to find it in metadata
        if (!agentId && item.message) {
          // Check metadata
          if (item.message.metadata && typeof item.message.metadata === 'object') {
            const metadata = item.message.metadata;
            if (metadata.agentId) {
              agentId = metadata.agentId;
            } else if (metadata.agent?.id) {
              agentId = metadata.agent.id;
            }
          }
        }
        
        // Look up agent details if we found an ID
        if (agentId) {
          agentDetail = agentMap.get(agentId);
          
          // Debug
          if (!agentDetail) {
            console.log(`No agent found for ID: ${agentId}`);
          }
        }
        
        // Extract batchId from chat
        const batchId = item.message?.chatId ? chatToBatchMap.get(item.message.chatId) : null;
        
        return {
          id: item.id,
          messageId: item.messageId,
          roundId: item.roundId,
          batchId: batchId || null,
          name: item.name,
          dataType: item.dataType,
          value: item.value,
          createdAt: item.createdAt,
          message: item.message ? {
            content: item.message.content,
            agentId: agentId,
            agent: agentDetail
          } : undefined
        };
      });
      
      console.log('Successfully processed data values');
      return NextResponse.json(formattedDataValues);
    } catch (formatError) {
      console.log('Error formatting data values');
      console.log('Error type:', formatError ? (typeof formatError) : 'null or undefined');
      console.log('Error message:', formatError instanceof Error ? formatError.message : 'No error message available');
      
      return NextResponse.json(
        { error: 'Failed to format data values', details: formatError instanceof Error ? formatError.message : 'Unknown formatting error' },
        { status: 500 }
      );
    }
  } catch (error) {
    // Log safely to avoid issues with console.error
    console.log('Top-level error occurred');
    console.log('Error type:', error ? (typeof error) : 'null or undefined');
    console.log('Error message:', error instanceof Error ? error.message : 'No error message available');
    
    return NextResponse.json(
      { error: 'Failed to fetch data values', details: error instanceof Error ? error.message : String(error || 'Unknown error') },
      { status: 500 }
    );
  }
} 