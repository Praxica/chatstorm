import { z } from 'zod'

type ToolFunction<T> = {
  description: string
  inputSchema: z.ZodObject<any>
  execute: (args: T) => Promise<any>
}

export function tool<T>({ description, inputSchema, execute }: ToolFunction<T>) {
  return {
    description,
    inputSchema,
    execute,
  };
} 