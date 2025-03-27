/**
 * Common type definitions used throughout the XcodeBuildMCP project
 */

/**
 * Standard response type for tool handlers that matches the MCP SDK expectations
 */
export interface ToolResponse {
  [key: string]: unknown;
  content: Array<
    | { [key: string]: unknown; type: 'text'; text: string }
    | { [key: string]: unknown; type: 'image'; data: string; mimeType: string }
    | {
        [key: string]: unknown;
        type: 'resource';
        resource:
          | { [key: string]: unknown; text: string; uri: string; mimeType?: string }
          | { [key: string]: unknown; uri: string; blob: string; mimeType?: string };
      }
  >;
  isError?: boolean;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errorResponse?: ToolResponse;
  warningResponse?: ToolResponse;
}
