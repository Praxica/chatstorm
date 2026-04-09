// services/config.ts
import { prisma } from "../../prisma";
import type { Config } from "@/lib/schemas/prisma-typed";

// Utility functions that operate on Config
export const ConfigUtils = {
  isFeatureEnabled(_config: Config, _featureName: string): boolean {
    // return config.features?.[featureName] === true;
    return true;
  },

  // Add more utility functions as needed
};

// Service for data operations
export const ConfigService = {
  async retrieve(id: string): Promise<Config> {
    const config = await prisma.config.findUnique({
      where: { id },
    });

    if (!config) {
      throw new Error(`Config with id ${id} not found`);
    }

    return config as Config;
  },

  // Other CRUD operations
};
