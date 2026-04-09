import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@clerk/nextjs/server'

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
  };
}

interface AgentDetail {
  id: string;
  name: string;
  role?: string;
  avatar?: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ configId: string, roundId: string }> }
) {
  console.log('Starting data-values GET request');
  try {
    // Log params
    const resolvedParams = await params;
    console.log('Request params:', resolvedParams);
    
    // Validate user authentication
    console.log('Authenticating user');
    const authResult = await auth();
    const userId = authResult.userId;
    console.log('Auth userId:', userId ? 'Found' : 'Not found');
    
    if (!userId) {
      console.log('User not authenticated');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get config and round IDs from params
    const { configId, roundId } = resolvedParams;
    console.log(`Processing request for configId: ${configId}, roundId: ${roundId}`);
    
    // userId is already the internal ID from getAuthenticatedUserId()
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
    
    // Verify the round belongs to the config
    console.log('Verifying round belongs to config');
    const round = await prisma.chatRound.findUnique({
      where: {
        id: roundId,
        configId
      }
    });
    
    console.log('Round:', round ? 'Found' : 'Not found');
    if (!round) {
      console.log('Round not found');
      return NextResponse.json(
        { error: 'Round not found' },
        { status: 404 }
      );
    }

    // Fetch the message data values for the round with message info
    console.log('Fetching message data values with Prisma query');
    
    let dataValues: MessageDataValue[] = [];
    
    try {
      console.log('Executing Prisma query...');
      
      // Use a standard Prisma query instead of raw SQL
      dataValues = await (prisma as any).MessageDataValue.findMany({
        where: {
          roundId
        },
        include: {
          message: {
            select: {
              content: true,
              agentId: true,
              metadata: true,
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
          hasAnnotations: !!dataValues[0].message?.annotations,
          annotationCount: dataValues[0].message?.annotations?.length
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
      
      dataValues.forEach(item => {
        // Check direct agentId field
        if (item.message?.agentId) {
          agentIds.push(item.message.agentId);
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
      console.log(`Found ${uniqueAgentIds.length} unique agent IDs to look up from combined sources`);
      
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
      
      const formattedDataValues = dataValues.map((item) => {
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
        
        // Create the formatted data value
        return {
          id: item.id,
          messageId: item.messageId,
          roundId: item.roundId,
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