/**
 * Simulator Tools - Functions for working with iOS simulators using xcrun simctl
 */

import { z } from "zod";
import { log } from "../utils/logger.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeXcodeCommand } from "../utils/xcode.js";
import { validateRequiredParam, validateFileExists } from "../utils/validation.js";

/**
 * Register the simulator tools with the MCP server
 * @param server The MCP server instance
 */
export function registerSimulatorTools(server: McpServer): void {
  // Register the boot simulator tool
  registerBootSimulatorTool(server);

  // Register the list simulators tool
  registerListSimulatorsTool(server);

  // Register the install app in simulator tool
  registerInstallAppInSimulatorTool(server);

  // Register the launch app in simulator tool
  registerLaunchAppInSimulatorTool(server);

  registerOpenSimulatorTool(server);
}

function registerBootSimulatorTool(server: McpServer): void {
  server.tool(
    "bootSimulator",
    "Boots an iOS simulator. Note: All parameters must be provided as an object, even if empty {}. To use this tool: 1) First run listSimulators({}) to get available simulator UUIDs, 2) Then boot a specific simulator with bootSimulator({ simulatorUuid: 'YOUR_UUID_HERE' }), 3) Finally use openSimulator({}) to view the simulator UI.",
    {
      simulatorUuid: z.string().describe("UUID of the simulator to use (obtained from listSimulators)")
    },
    async (params) => {
      // Validate required parameters
      const simulatorUuidValidation = validateRequiredParam('simulatorUuid', params.simulatorUuid);
      if (!simulatorUuidValidation.isValid) {
        return simulatorUuidValidation.errorResponse;
      }

      // Log that we're starting a boot simulator request
      log('info', `Starting xcrun simctl boot request for simulator ${params.simulatorUuid}`);

      try {
        // Construct the xcrun simctl command to boot the simulator
        const command = ["xcrun", "simctl", "boot", params.simulatorUuid];

        // Execute the command
        const result = await executeXcodeCommand(command, "Boot Simulator");

        // Handle the result
        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: `Boot simulator operation failed: ${result.error}`,
              },
            ],
          };
        }

        // Return success response
        return {
          content: [
            {
              type: "text",
              text: `Simulator booted successfully: ${result.output}`,
            },
          ],
        };
      } catch (error) {
        log('error', `Error during boot simulator operation: ${error}`);
        return {
          content: [
            {
              type: "text",
              text: `Boot simulator operation failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}

/**
 * Register the list simulators tool
 * @param server The MCP server instance
 */
function registerListSimulatorsTool(server: McpServer): void {
  server.tool(
    "listSimulators",
    "Lists available iOS simulators with their UUIDs. Note: Requires an empty object {} as parameters due to the MCP protocol.",
    {},
    async () => {
      // Log that we're starting a list simulators request
      log('info', 'Starting xcrun simctl list devices request');

      try {
        // Execute the command to list available simulators
        const command = ["xcrun", "simctl", "list", "devices", "available", "--json"];
        const result = await executeXcodeCommand(command, "List Simulators");

        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to list simulators: ${result.error}`,
              },
            ],
          };
        }

        // Return the list of simulators
        return {
          content: [
            {
              type: "text",
              text: result.output,
            },
          ],
        };
      } catch (error) {
        log('error', `Error listing simulators: ${error}`);
        return {
          content: [
            {
              type: "text",
              text: `Failed to list simulators: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}

/**
 * Register the install app in simulator tool
 * @param server The MCP server instance
 */
function registerInstallAppInSimulatorTool(server: McpServer): void {
  server.tool(
    "installAppInSimulator",
    "Installs an app in an iOS simulator. Note: All parameters must be provided as an object, even if empty {}. The appPath is typically found in the DerivedData directory after building the app (e.g., ~/Library/Developer/Xcode/DerivedData/[ProjectName]/Build/Products/Debug-iphonesimulator/[AppName].app).",
    {
      simulatorUuid: z.string().describe("UUID of the simulator to use (obtained from listSimulators)"),
      appPath: z.string().describe("Path to the .app bundle to install (full path to the .app directory)")
    },
    async (params) => {
      // Validate required parameters
      const simulatorUuidValidation = validateRequiredParam('simulatorUuid', params.simulatorUuid);
      if (!simulatorUuidValidation.isValid) {
        return simulatorUuidValidation.errorResponse;
      }

      const appPathValidation = validateRequiredParam('appPath', params.appPath);
      if (!appPathValidation.isValid) {
        return appPathValidation.errorResponse;
      }

      // Validate that the app path exists
      const appPathExistsValidation = validateFileExists(params.appPath);
      if (!appPathExistsValidation.isValid) {
        return appPathExistsValidation.errorResponse;
      }

      // Log that we're starting an install app in simulator request
      log('info', `Starting xcrun simctl install request for simulator ${params.simulatorUuid}`);

      try {
        // Construct the xcrun simctl command to install the app
        const command = ["xcrun", "simctl", "install", params.simulatorUuid, params.appPath];

        // Execute the command
        const result = await executeXcodeCommand(command, "Install App in Simulator");

        // Handle the result
        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: `Install app in simulator operation failed: ${result.error}`,
              },
            ],
          };
        }

        // Return success response
        return {
          content: [
            {
              type: "text",
              text: `App installed successfully in simulator ${params.simulatorUuid}`,
            },
          ],
        };
      } catch (error) {
        log('error', `Error during install app in simulator operation: ${error}`);
        return {
          content: [
            {
              type: "text",
              text: `Install app in simulator operation failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}

/**
 * Register the launch app in simulator tool
 * @param server The MCP server instance
 */
function registerLaunchAppInSimulatorTool(server: McpServer): void {
  server.tool(
    "launchAppInSimulator",
    "Launches an app in an iOS simulator. Note: All parameters must be provided as an object, even if empty {}. The bundleId can be found in the app's Info.plist file or in the project.pbxproj file (look for PRODUCT_BUNDLE_IDENTIFIER).",
    {
      simulatorUuid: z.string().describe("UUID of the simulator to use (obtained from listSimulators)"),
      bundleId: z.string().describe("Bundle identifier of the app to launch (e.g., 'com.example.MyApp')"),
      args: z.array(z.string()).optional().describe("Additional arguments to pass to the app")
    },
    async (params) => {
      // Validate required parameters
      const simulatorUuidValidation = validateRequiredParam('simulatorUuid', params.simulatorUuid);
      if (!simulatorUuidValidation.isValid) {
        return simulatorUuidValidation.errorResponse;
      }

      const bundleIdValidation = validateRequiredParam('bundleId', params.bundleId);
      if (!bundleIdValidation.isValid) {
        return bundleIdValidation.errorResponse;
      }

      // Log that we're starting a launch app in simulator request
      log('info', `Starting xcrun simctl launch request for simulator ${params.simulatorUuid} and bundle ${params.bundleId}`);

      try {
        // Construct the xcrun simctl command to launch the app
        let command = ["xcrun", "simctl", "launch", params.simulatorUuid, params.bundleId];

        // Add any additional arguments
        if (params.args && params.args.length > 0) {
          command.push(...params.args);
        }

        // Execute the command
        const result = await executeXcodeCommand(command, "Launch App in Simulator");

        // Handle the result
        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: `Launch app in simulator operation failed: ${result.error}`,
              },
            ],
          };
        }

        // Return success response
        return {
          content: [
            {
              type: "text",
              text: `App launched successfully in simulator ${params.simulatorUuid}: ${result.output}`,
            },
          ],
        };
      } catch (error) {
        log('error', `Error during launch app in simulator operation: ${error}`);
        return {
          content: [
            {
              type: "text",
              text: `Launch app in simulator operation failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}

function registerOpenSimulatorTool(server: McpServer): void {
  server.tool(
    "openSimulator",
    "Opens the iOS Simulator app. Note: Requires an empty object {} as parameters due to the MCP protocol. Use this tool after booting a simulator with bootSimulator to see the simulator UI. Typical workflow: 1) listSimulators({}), 2) bootSimulator({ simulatorUuid: 'UUID' }), 3) openSimulator({}).",
    {},
    async () => {
      // Log that we're starting an open simulator request
      log('info', 'Starting open simulator request');

      try {
        // Execute the command
        const command = ["open", "-a", "Simulator"];

        // Execute the command
        const result = await executeXcodeCommand(command, "Open Simulator");

        // Handle the result
        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: `Open simulator operation failed: ${result.error}`,
              },
            ],
          };
        }

        // Return success response
        return {
          content: [
            {
              type: "text",
              text: `Simulator opened successfully: ${result.output}`,
            },
          ],
        };
      } catch (error) {
        log('error', `Error during open simulator operation: ${error}`);
        return {
          content: [
            {
              type: "text",
              text: `Open simulator operation failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}