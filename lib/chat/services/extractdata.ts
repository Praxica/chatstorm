import { generateObject } from "ai";
import { ChatState } from "../types";
import { z } from "zod";
import { ModelService } from './models';
import { prisma } from "@/lib/prisma";
import { generateText } from 'ai';

// Define the DataTool interface to match the structure
interface DataTool {
  instructions: string;
  parameters: Array<{
    name: string;
    description: string;
    type: string;
  }>;
  useDefaultModel?: boolean;
}

export const ExtractDataService = {

  async saveMessageData(chatState: ChatState, message: any) {
    const {activeRound:round} = chatState;

    if (!round || !round.dataTool) {
      return;
    }

    console.log(`Setting up data extraction for message ${message.id} using dataTool`);
    // Process data extraction as a non-blocking operation
    // This happens after the message has been streamed to the client
    const extractionResult = await this.extractMessageData(chatState, message);
    
    console.log(`Data extraction completed with status: ${extractionResult?.success ? 'success' : 'failed'}`);
    
    if (!extractionResult?.success) {
      console.error('Data extraction error:', extractionResult?.error);
    } else if (extractionResult.success && 'savedValues' in extractionResult && 
              Array.isArray(extractionResult.savedValues) && extractionResult.savedValues.length > 0) {
      console.log(`Saved ${extractionResult.savedValues.length} data values`);
    }
  },


  // Helper function to build parameter schema from dataTool configuration
  buildParameterSchema (parameters: Array<{
    name: string;
    description: string;
    type: string;
  }>) {
    // Create a shape object for the Zod schema
    const schemaShape: Record<string, any> = {};
    
    parameters.forEach(param => {
      let zodType;
      
      switch (param.type) {
        case 'string':
          zodType = z.string().describe(param.description);
          break;
        case 'number':
          zodType = z.number().describe(param.description);
          break;
        case 'boolean':
          zodType = z.boolean().describe(param.description);
          break;
        case 'array_string':
          zodType = z.array(z.string()).describe(param.description);
          break;
        case 'array_number':
          zodType = z.array(z.number()).describe(param.description);
          break;
        case 'keyvalue':
          zodType = z.record(z.string()).describe(param.description);
          break;
        default:
          zodType = z.string().describe(param.description);
      }
      
      schemaShape[param.name] = zodType;
    });
    
    return z.object(schemaShape);
  },

  async extractMessageData(chatState: ChatState, message: any) {
    console.log('==== EXTRACTION DEBUG START ====');

    const {activeRound:round} = chatState;

    // Get the message content
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
    
    if (!round || !round.dataTool) {
      console.log('No dataTool defined for this round');
      return { success: false, error: 'No dataTool defined' };
    }
    
    // Type assertion for dataTool to fix TypeScript errors
    const dataTool = round.dataTool as unknown as DataTool;
    
    // Build the Zod schema from the parameters
    const schema = this.buildParameterSchema(dataTool.parameters);
      
    // Create a readable version of the schema for the prompt
    const schemaDescription = dataTool.parameters.map((param: { name: string; type: string; description: string }) => 
      `${param.name} (${param.type}): ${param.description}`
    ).join('\n');
      
    // Create the extraction prompt - add explicit instruction to return ONLY JSON
    const extractionPrompt = `
Extract the following structured data from this content according to these instructions:
${dataTool.instructions}

Here is the content to analyze:
${content}

Please extract the data according to this schema:
${schemaDescription}

IMPORTANT: Return ONLY a valid JSON object with no explanations, comments, formatting, or additional text.
For example: { "field1": "value1", "field2": 123 }
`;
      
    try {
      // Use the new model selection logic
      const model = ModelService.getLLMModel(chatState);
      
      try {
        // Call generateObject with the resolved model instance
        const extractionResponse = await generateObject({
          model, // Pass the resolved model instance
          messages: [
            {
              role: 'system',
              content: extractionPrompt
            },
            {
              role: 'user',
              content: 'Please extract the structured data as a valid JSON object according to your instructions.'
            }
          ],
          schema,
        });
        
        // The actual extracted data is in the object property
        const extractedData = extractionResponse.object || {};
        
        if (!extractedData || Object.keys(extractedData).length === 0) {
          console.log('No data was extracted or object property is empty');
          return {
            success: false,
            error: 'No data was extracted',
            response: extractionResponse
          };
        }
        
        // Handle successful extraction
        return this.saveExtractedData(extractedData, dataTool, message, round);
        
      } catch (generateObjectError) {
        // If generateObject fails, try manual extraction as a fallback
        console.log('generateObject failed, attempting to manually extract JSON from the response text:', generateObjectError);
        
        // Try a more direct approach with generateText instead
        const textResponse = await generateText({
          model,
          messages: [
            {
              role: 'system',
              content: extractionPrompt
            },
            {
              role: 'user',
              content: 'Return ONLY a valid JSON object. No explanations, no markdown formatting.'
            }
          ],
        });
        
        console.log('Manual extraction text response:', textResponse.text.substring(0, 100) + '...');
        
        // Try to extract JSON from the text using regex
        const jsonData = this.extractJsonFromText(textResponse.text);
        
        if (jsonData) {
          console.log('Successfully extracted JSON from text response');
          return this.saveExtractedData(jsonData, dataTool, message, round);
        }
        
        // If that fails too, rethrow the original error
        throw generateObjectError;
      }
    } catch (error) {
      console.error('Error generating object:', error);
      console.error(error instanceof Error ? error.stack : 'No stack trace available');
      return { 
        success: false, 
        error: 'Error generating structured data from message' 
      };
    }
  },
  
  // Helper function to extract JSON from text
  extractJsonFromText(text: string) {
    try {
      // Try to find JSON pattern with opening and closing braces
      const jsonRegex = /{[\s\S]*?}/;
      const match = text.match(jsonRegex);
      
      if (match && match[0]) {
        // Parse the JSON to validate it
        return JSON.parse(match[0]);
      }
      
      // If no match is found, return null
      return null;
    } catch (e) {
      console.error('Error extracting JSON from text:', e);
      return null;
    }
  },
  
  // Helper function to save extracted data
  async saveExtractedData(extractedData: any, dataTool: DataTool, message: any, round: any) {
    try {
      // Store validated values in the database
      const savedValues = [];
      console.log(`Starting to save ${Object.keys(extractedData).length} data values to database...`);
      
      for (const [name, value] of Object.entries(extractedData)) {
        const paramDef = dataTool.parameters.find((p: { name: string }) => p.name === name);
        
        if (!paramDef) {
          console.log(`Parameter ${name} not found in dataTool definition, skipping`);
          continue;
        }
        
        try {
          // Ensure value is a primitive type that Prisma can handle
          let sanitizedValue: any = value;
          if (typeof value === 'object' && value !== null) {
            // Convert object to string to ensure it can be stored
            sanitizedValue = JSON.stringify(value);
          }
          
          // NOTE: Using standard Prisma API
          // messageDataValue exists after running npx prisma generate
          const dataValue = await prisma.messageDataValue.create({
            data: {
              messageId: message.id,
              roundId: round.id || null,
              name,
              dataType: paramDef.type,
              value: sanitizedValue, // Prisma handles JSON serialization automatically
            },
            select: { id: true }
          });
          
          // Use the Prisma-returned ID directly
          const resultId = dataValue.id;
          console.log(`Successfully saved parameter ${name} with id: ${resultId}`);

          savedValues.push({
            id: resultId,
            name,
            value
          });
        } catch (err) {
          console.error(`Error saving parameter ${name}:`, err);
          console.error(`Value was: ${JSON.stringify(value)}`);
        }
      }
      
      console.log(`Completed saving data values. Successfully saved ${savedValues.length} values.`);
      console.log('==== EXTRACTION DEBUG END ====');
      
      return {
        success: true,
        data: extractedData,
        savedValues,
      };
    } catch (dbError) {
      console.error('Error saving data values to database:', dbError);
      console.error(dbError instanceof Error ? dbError.stack : 'No stack trace available');
      return { 
        success: false, 
        error: 'Database error when saving data values' 
      };
    }
  }
};