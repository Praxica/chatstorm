// services/config.ts
import { auth } from "@clerk/nextjs/server";
import { prisma } from "../../prisma";
import { User } from "@prisma/client";
import { ChatState } from "../types";

// Service for data operations
export const UserService = {
  async retrieve(chatState: ChatState): Promise<User> {// Get user ID from auth

    let userId = chatState.user.id;

    if (!userId) {
      const authResult = await auth();
      userId = authResult.userId || '';
    }

    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Determine if the userId looks like a UUID or an external ID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    
    // Construct a query that safely handles both internal UUIDs and external IDs
    const whereClause = isUuid 
      ? { OR: [{ externalId: userId }, { id: userId }] }
      : { externalId: userId };

    const user = await prisma.user.findFirst({
      where: whereClause,
      include: { capabilities: true },
    });

    if (!user) {
      throw new Error('User not found for id: ' + userId);
    }

    return user;
  },
  
  // Other CRUD operations
};