/**
 * Clean Tool - Uses xcodebuild's native clean action to clean build products
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { log } from "../utils/logger.js";
import { executeXcodeCommand, addXcodeParameters } from "../utils/xcode.js";
import { validateRequiredParam, validateCondition } from "../utils/validation.js";

/**
 * Register the clean tool with the MCP server
 * @param server The MCP server instance
 */
export function registerCleanTool(server: McpServer): void {
  server.tool(
    "clean",
    "Cleans build products using xcodebuild's native clean action. Note: All parameters must be provided as an object, even if empty {}.",
    {
      workspacePath: z.string().optional().describe("Path to the .xcworkspace file"),
      projectPath: z.string().optional().describe("Path to the .xcodeproj file"),
      scheme: z.string().optional().describe("The scheme to clean"),
      configuration: z.string().optional().describe("Build configuration to clean (Debug, Release, etc.)"),
      derivedDataPath: z.string().optional().describe("Path where build products and other derived data will go"),
      extraArgs: z.array(z.string()).optional().describe("Additional xcodebuild arguments")
    },
    async (params) => {
      // If neither workspacePath nor projectPath is provided, add a warning to the response
      const pathValidation = validateCondition(
        !!(params.workspacePath || params.projectPath), // Convert to boolean with double negation
        'Neither workspacePath nor projectPath was provided. xcodebuild will look for a project in the current directory.'
      );
      
      let warningMessages = [];
      if (!pathValidation.isValid) {
        warningMessages.push(pathValidation.warningResponse.content[0]);
      }

      // Log that we're starting a clean request
      log('info', 'Starting xcodebuild clean request');

      try {
        // Construct the xcodebuild clean command
        let command = ["xcodebuild", "clean"];

        // Add common Xcode parameters
        addXcodeParameters(command, params, "Cleaning");

        // Execute the command
        const result = await executeXcodeCommand(command, "Clean");

        // Handle the result
        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: `Clean operation failed: ${result.error}`,
              },
            ],
          };
        }

        // Return success response with any warnings
        const responseContent = [
          ...warningMessages,
          {
            type: "text",
            text: `Clean operation successful: ${result.output}`,
          },
        ];
        
        return {
          content: responseContent,
        };
      } catch (error) {
        log('error', `Error during clean operation: ${error}`);
        return {
          content: [
            {
              type: "text",
              text: `Clean operation failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
