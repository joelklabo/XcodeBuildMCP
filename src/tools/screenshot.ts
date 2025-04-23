import { z } from 'zod';
import { execSync } from 'child_process';
import { log } from '../utils/logger.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { validateRequiredParam } from '../utils/validation.js';
import { ToolResponse } from '../types/common.js';

/**
 * Takes a screenshot of the currently booted iOS simulator.
 * IMPORTANT: You MUST provide the outputPath parameter.
 * Example: take_screenshot({ outputPath: '/path/to/screenshot.png' })
 */
export function registerTakeScreenshotTool(server: McpServer): void {
  server.tool(
    'take_screenshot',
    "Takes a screenshot of the currently booted iOS simulator. IMPORTANT: You MUST provide the outputPath parameter. Example: take_screenshot({ outputPath: '/path/to/screenshot.png' })",
    {
      outputPath: z
        .string()
        .describe('Path where the screenshot will be saved (full path to the .png file)'),
    },
    async (params): Promise<ToolResponse> => {
      // Validate required parameters
      const outputPathValidation = validateRequiredParam('outputPath', params.outputPath);
      if (!outputPathValidation.isValid) {
        return outputPathValidation.errorResponse!;
      }

      log('info', `Starting screenshot request for output path ${params.outputPath}`);

      try {
        // Construct the command
        const command = `xcrun simctl io booted screenshot "${params.outputPath}"`;

        // Execute the command
        execSync(command);

        // Return success response
        return {
          content: [
            {
              type: 'text',
              text: `✅ Screenshot taken successfully: ${params.outputPath}`,
            },
          ],
        };
      } catch (error) {
        // Handle errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('error', `Error during screenshot operation: ${errorMessage}`);
        return {
          content: [
            {
              type: 'text',
              text: `❌ Screenshot operation failed: ${errorMessage}`,
            },
          ],
        };
      }
    },
  );
}
