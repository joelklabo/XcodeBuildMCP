/**
 * Bundle ID Helper Tools - Functions for extracting bundle IDs from Xcode projects
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { log } from "../utils/logger.js";
import { validateRequiredParam, validateFileExists } from "../utils/validation.js";
import { execSync } from "child_process";

/**
 * Register the bundle ID helper tools
 * @param server The MCP server instance
 */
export function registerBundleIdTool(server: McpServer): void {
  registerGetBundleIdTool(server);
  registerGetiOSBundleIdTool(server);
  registerGetMacOSBundleIdTool(server);
}

/**
 * Register the get bundle ID tool (generic - will be deprecated)
 * @param server The MCP server instance
 */
function registerGetBundleIdTool(server: McpServer): void {
  server.tool(
    "getBundleId",
    "Extracts the bundle identifier from an app bundle (.app). Note: This tool will be deprecated in favor of platform-specific tools. Note: All parameters must be provided as an object, even if empty {}.",
    {
      appPath: z.string().describe("Path to the .app bundle to extract bundle ID from (full path to the .app directory)")
    },
    async (params) => {
      // Validate required parameters
      const appPathValidation = validateRequiredParam('appPath', params.appPath);
      if (!appPathValidation.isValid) {
        return appPathValidation.errorResponse;
      }

      // Check if the app path exists
      const appPathExistsValidation = validateFileExists(params.appPath);
      if (!appPathExistsValidation.isValid) {
        return appPathExistsValidation.errorResponse;
      }

      // Log that we're starting a get bundle ID request
      log('info', `Starting bundle ID extraction for app at ${params.appPath}`);

      try {
        // Try iOS path first
        let command = `defaults read "${params.appPath}/Info" CFBundleIdentifier`;
        log('info', `Trying iOS path with command: ${command}`);
        
        try {
          const output = execSync(command, { encoding: 'utf-8' }).trim();
          if (output) {
            return {
              content: [
                {
                  type: "text",
                  text: `Bundle ID: ${output}\n\nNext Steps:\n- Use this bundle ID with the launchAppInSimulator tool\n- Example: launchAppInSimulator({ simulatorUuid: "YOUR_SIMULATOR_UUID", bundleId: "${output}" })`,
                },
              ],
            };
          }
        } catch (error) {
          log('info', `iOS path failed, trying macOS path next`);
        }

        // Try macOS path next
        command = `defaults read "${params.appPath}/Contents/Info" CFBundleIdentifier`;
        log('info', `Trying macOS path with command: ${command}`);
        
        const output = execSync(command, { encoding: 'utf-8' }).trim();
        
        if (!output) {
          return {
            content: [
              {
                type: "text",
                text: `Bundle ID not found in the app's Info.plist. Please check that the app path is correct and the app has a valid Info.plist file.`,
              },
            ],
          };
        }

        // Return the bundle ID with next steps guidance
        return {
          content: [
            {
              type: "text",
              text: `Bundle ID: ${output}\n\nNext Steps:\n- Use this bundle ID with the appropriate tool for your platform`,
            },
          ],
        };
      } catch (error) {
        log('error', `Error extracting bundle ID: ${error instanceof Error ? error.message : String(error)}`);
        
        return {
          content: [
            {
              type: "text",
              text: `Error extracting bundle ID: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}

/**
 * Register the get iOS bundle ID tool
 * @param server The MCP server instance
 */
function registerGetiOSBundleIdTool(server: McpServer): void {
  server.tool(
    "getiOSBundleId",
    "Extracts the bundle identifier from an iOS app bundle (.app). Note: All parameters must be provided as an object, even if empty {}.",
    {
      appPath: z.string().describe("Path to the iOS .app bundle to extract bundle ID from (full path to the .app directory)")
    },
    async (params) => {
      // Validate required parameters
      const appPathValidation = validateRequiredParam('appPath', params.appPath);
      if (!appPathValidation.isValid) {
        return appPathValidation.errorResponse;
      }

      // Check if the app path exists
      const appPathExistsValidation = validateFileExists(params.appPath);
      if (!appPathExistsValidation.isValid) {
        return appPathExistsValidation.errorResponse;
      }

      // Log that we're starting a get bundle ID request
      log('info', `Starting iOS bundle ID extraction for app at ${params.appPath}`);

      try {
        // Use defaults read to extract the bundle ID from Info.plist for iOS
        const command = `defaults read "${params.appPath}/Info" CFBundleIdentifier`;
        log('info', `Executing command: ${command}`);
        
        const output = execSync(command, { encoding: 'utf-8' }).trim();
        
        if (!output) {
          return {
            content: [
              {
                type: "text",
                text: `Bundle ID not found in the iOS app's Info.plist. Please check that the app path is correct and the app has a valid Info.plist file.`,
              },
            ],
          };
        }

        // Return the bundle ID with next steps guidance
        return {
          content: [
            {
              type: "text",
              text: `iOS Bundle ID: ${output}\n\nNext Steps:\n- Use this bundle ID with the launchAppInSimulator tool\n- Example: launchAppInSimulator({ simulatorUuid: "YOUR_SIMULATOR_UUID", bundleId: "${output}" })`,
            },
          ],
        };
      } catch (error) {
        log('error', `Error extracting iOS bundle ID: ${error instanceof Error ? error.message : String(error)}`);
        
        return {
          content: [
            {
              type: "text",
              text: `Error extracting iOS bundle ID: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}

/**
 * Register the get macOS bundle ID tool
 * @param server The MCP server instance
 */
function registerGetMacOSBundleIdTool(server: McpServer): void {
  server.tool(
    "getMacOSBundleId",
    "Extracts the bundle identifier from a macOS app bundle (.app). Note: All parameters must be provided as an object, even if empty {}.",
    {
      appPath: z.string().describe("Path to the macOS .app bundle to extract bundle ID from (full path to the .app directory)")
    },
    async (params) => {
      // Validate required parameters
      const appPathValidation = validateRequiredParam('appPath', params.appPath);
      if (!appPathValidation.isValid) {
        return appPathValidation.errorResponse;
      }

      // Check if the app path exists
      const appPathExistsValidation = validateFileExists(params.appPath);
      if (!appPathExistsValidation.isValid) {
        return appPathExistsValidation.errorResponse;
      }

      // Log that we're starting a get bundle ID request
      log('info', `Starting macOS bundle ID extraction for app at ${params.appPath}`);

      try {
        // Use defaults read to extract the bundle ID from Info.plist for macOS
        const command = `defaults read "${params.appPath}/Contents/Info" CFBundleIdentifier`;
        log('info', `Executing command: ${command}`);
        
        const output = execSync(command, { encoding: 'utf-8' }).trim();
        
        if (!output) {
          return {
            content: [
              {
                type: "text",
                text: `Bundle ID not found in the macOS app's Info.plist. Please check that the app path is correct and the app has a valid Info.plist file.`,
              },
            ],
          };
        }

        // Return the bundle ID with next steps guidance
        return {
          content: [
            {
              type: "text",
              text: `macOS Bundle ID: ${output}\n\nNext Steps:\n- Use this bundle ID to launch the macOS application`,
            },
          ],
        };
      } catch (error) {
        log('error', `Error extracting macOS bundle ID: ${error instanceof Error ? error.message : String(error)}`);
        
        return {
          content: [
            {
              type: "text",
              text: `Error extracting macOS bundle ID: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
