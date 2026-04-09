/**
 * Helper for development-only logging
 * @param context The context of the log (e.g., component or service name)
 * @param message The message to log
 * @param args Additional arguments to log
 */
export const logDebug = (context: string, message: string, ...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG][${context}] ${message}`, ...args);
  }
}; 