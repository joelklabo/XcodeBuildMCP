/**
 * Simple logging utility for the XcodeBuildMCP server
 * Only logs to stderr to avoid interfering with MCP protocol
 */

/**
 * Log a message with the specified level
 * @param level The log level (info, warning, error, debug)
 * @param message The message to log
 */
export function log(level: string, message: string): void {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
}
