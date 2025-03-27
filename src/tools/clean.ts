/**
 * Clean Tool - Uses xcodebuild's native clean action to clean build products
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { log } from '../utils/logger.js';
import { executeXcodeCommand, addXcodeParameters } from '../utils/xcode.js';
import { validateCondition } from '../utils/validation.js';
import { ToolResponse } from '../types/common.js';

// Define a type for content items that matches the ToolResponse content array type
type ContentItem =
  | { [key: string]: unknown; type: 'text'; text: string }
  | { [key: string]: unknown; type: 'image'; data: string; mimeType: string }
  | {
      [key: string]: unknown;
      type: 'resource';
      resource:
        | { [key: string]: unknown; text: string; uri: string; mimeType?: string }
        | { [key: string]: unknown; uri: string; blob: string; mimeType?: string };
    };

export function registerCleanTool(server: McpServer): void {
  server.tool(
    'clean',
    "Cleans build products using xcodebuild's native clean action. Note: All parameters must be provided as an object, even if empty {}. Example: clean({ workspacePath: '/path/to/workspace', scheme: 'MyScheme' }) Note: In some environments, this tool may be prefixed as mcp0_clean.",
    {
      workspacePath: z.string().optional().describe('Path to the .xcworkspace file'),
      projectPath: z.string().optional().describe('Path to the .xcodeproj file'),
      scheme: z.string().optional().describe('The scheme to clean'),
      configuration: z
        .string()
        .optional()
        .describe('Build configuration to clean (Debug, Release, etc.)'),
      derivedDataPath: z
        .string()
        .optional()
        .describe('Path where build products and other derived data will go'),
      extraArgs: z.array(z.string()).optional().describe('Additional xcodebuild arguments'),
    },
    async (params): Promise<ToolResponse> => {
      const pathValidation = validateCondition(
        !!(params.workspacePath || params.projectPath),
        'Neither workspacePath nor projectPath was provided. xcodebuild will look for a project in the current directory.',
      );

      const warningMessages: ContentItem[] = [];
      if (!pathValidation.isValid && pathValidation.warningResponse) {
        warningMessages.push({
          type: 'text',
          text: String(pathValidation.warningResponse.content[0].text),
        } as ContentItem);
      }

      log('info', 'Starting xcodebuild clean request');

      try {
        const command = ['xcodebuild', 'clean'];
        addXcodeParameters(command, params, 'Cleaning');
        const result = await executeXcodeCommand(command, 'Clean');

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Clean operation failed: ${String(result.error)}`,
              } as ContentItem,
            ],
          };
        }

        const responseContent: ContentItem[] = [
          ...warningMessages,
          {
            type: 'text',
            text: `Clean operation successful: ${String(result.output)}`,
          } as ContentItem,
        ];

        return {
          content: responseContent,
        };
      } catch (error) {
        log('error', `Error during clean operation: ${error}`);
        return {
          content: [
            {
              type: 'text',
              text: `Clean operation failed: ${error instanceof Error ? error.message : String(error)}`,
            } as ContentItem,
          ],
        };
      }
    },
  );
}
