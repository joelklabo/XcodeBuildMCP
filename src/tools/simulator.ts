/**
 * Simulator Tools - Functions for working with iOS simulators using xcrun simctl
 */

import { z } from 'zod';
import { log } from '../utils/logger.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeXcodeCommand } from '../utils/xcode.js';
import { validateRequiredParam, validateFileExists } from '../utils/validation.js';
import { ToolResponse } from '../types/common.js';
import { execSync } from 'child_process';

/**
 * Boots an iOS simulator. IMPORTANT: You MUST provide the simulatorUuid parameter. Example: boot_simulator({ simulatorUuid: 'YOUR_UUID_HERE' }) Note: In some environments, this tool may be prefixed as mcp0_boot_simulator.
 */
export function registerBootSimulatorTool(server: McpServer): void {
  server.tool(
    'boot_simulator',
    "Boots an iOS simulator. IMPORTANT: You MUST provide the simulatorUuid parameter. Example: boot_simulator({ simulatorUuid: 'YOUR_UUID_HERE' }) Note: In some environments, this tool may be prefixed as mcp0_boot_simulator.",
    {
      simulatorUuid: z
        .string()
        .describe('UUID of the simulator to use (obtained from list_simulators)'),
    },
    async (params): Promise<ToolResponse> => {
      const simulatorUuidValidation = validateRequiredParam('simulatorUuid', params.simulatorUuid);
      if (!simulatorUuidValidation.isValid) {
        return simulatorUuidValidation.errorResponse!;
      }

      log('info', `Starting xcrun simctl boot request for simulator ${params.simulatorUuid}`);

      try {
        const command = ['xcrun', 'simctl', 'boot', params.simulatorUuid];
        const result = await executeXcodeCommand(command, 'Boot Simulator');

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Boot simulator operation failed: ${result.error}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Simulator booted successfully. Next steps:
1. Open the Simulator app: open_simulator({})
2. Install an app: install_app_in_simulator({ simulatorUuid: "${params.simulatorUuid}", appPath: "PATH_TO_YOUR_APP" })
3. Launch an app: launch_app_in_simulator({ simulatorUuid: "${params.simulatorUuid}", bundleId: "YOUR_APP_BUNDLE_ID" })`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('error', `Error during boot simulator operation: ${errorMessage}`);
        return {
          content: [
            {
              type: 'text',
              text: `Boot simulator operation failed: ${errorMessage}`,
            },
          ],
        };
      }
    },
  );
}

export function registerListSimulatorsTool(server: McpServer): void {
  server.tool(
    'list_simulators',
    'Lists available iOS simulators with their UUIDs. IMPORTANT: You MUST provide an empty object {} as parameters. Example: list_simulators({})',
    {
      _dummy: z
        .boolean()
        .optional()
        .describe(
          'This is a dummy parameter. You must still provide an empty object {}. Example: list_simulators({})',
        ),
    },
    async (): Promise<ToolResponse> => {
      log('info', 'Starting xcrun simctl list devices request');

      try {
        const command = ['xcrun', 'simctl', 'list', 'devices', 'available', '--json'];
        const result = await executeXcodeCommand(command, 'List Simulators');

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to list simulators: ${result.error}`,
              },
            ],
          };
        }

        try {
          const simulatorsData = JSON.parse(result.output);
          let responseText = 'Available iOS Simulators:\n\n';

          for (const runtime in simulatorsData.devices) {
            const devices = simulatorsData.devices[runtime];

            if (devices.length === 0) continue;

            responseText += `${runtime}:\n`;

            for (const device of devices) {
              if (device.isAvailable) {
                responseText += `- ${device.name} (${device.udid})${device.state === 'Booted' ? ' [Booted]' : ''}\n`;
              }
            }

            responseText += '\n';
          }

          responseText += 'Next Steps:\n';
          responseText +=
            "1. Boot a simulator: boot_simulator({ simulatorUuid: 'UUID_FROM_ABOVE' })\n";
          responseText += '2. Open the simulator UI: open_simulator({})\n';
          responseText +=
            "3. Build for simulator: ios_simulator_build_by_id({ scheme: 'YOUR_SCHEME', simulatorId: 'UUID_FROM_ABOVE' })\n";
          responseText +=
            "4. Get app path: get_app_path_by_id({ scheme: 'YOUR_SCHEME', simulatorId: 'UUID_FROM_ABOVE' })";

          return {
            content: [
              {
                type: 'text',
                text: responseText,
              },
            ],
          };
        } catch {
          return {
            content: [
              {
                type: 'text',
                text: result.output,
              },
            ],
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('error', `Error listing simulators: ${errorMessage}`);
        return {
          content: [
            {
              type: 'text',
              text: `Failed to list simulators: ${errorMessage}`,
            },
          ],
        };
      }
    },
  );
}

export function registerInstallAppInSimulatorTool(server: McpServer): void {
  server.tool(
    'install_app_in_simulator',
    "Installs an app in an iOS simulator. IMPORTANT: You MUST provide both the simulatorUuid and appPath parameters. Example: install_app_in_simulator({ simulatorUuid: 'YOUR_UUID_HERE', appPath: '/path/to/your/app.app' })",
    {
      simulatorUuid: z
        .string()
        .describe('UUID of the simulator to use (obtained from list_simulators)'),
      appPath: z
        .string()
        .describe('Path to the .app bundle to install (full path to the .app directory)'),
    },
    async (params): Promise<ToolResponse> => {
      const simulatorUuidValidation = validateRequiredParam('simulatorUuid', params.simulatorUuid);
      if (!simulatorUuidValidation.isValid) {
        return simulatorUuidValidation.errorResponse!;
      }

      const appPathValidation = validateRequiredParam('appPath', params.appPath);
      if (!appPathValidation.isValid) {
        return appPathValidation.errorResponse!;
      }

      const appPathExistsValidation = validateFileExists(params.appPath);
      if (!appPathExistsValidation.isValid) {
        return appPathExistsValidation.errorResponse!;
      }

      log('info', `Starting xcrun simctl install request for simulator ${params.simulatorUuid}`);

      try {
        const command = ['xcrun', 'simctl', 'install', params.simulatorUuid, params.appPath];
        const result = await executeXcodeCommand(command, 'Install App in Simulator');

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Install app in simulator operation failed: ${result.error}`,
              },
            ],
          };
        }

        let bundleId = '';
        try {
          bundleId = execSync(`defaults read "${params.appPath}/Info" CFBundleIdentifier`)
            .toString()
            .trim();
        } catch (error) {
          log('warning', `Could not extract bundle ID from app: ${error}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: `App installed successfully in simulator ${params.simulatorUuid}`,
            },
            {
              type: 'text',
              text: `Next Steps:
1. Open the Simulator app: open_simulator({})
2. Launch the app: launch_app_in_simulator({ simulatorUuid: "${params.simulatorUuid}"${bundleId ? `, bundleId: "${bundleId}"` : ', bundleId: "YOUR_APP_BUNDLE_ID"'} })`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('error', `Error during install app in simulator operation: ${errorMessage}`);
        return {
          content: [
            {
              type: 'text',
              text: `Install app in simulator operation failed: ${errorMessage}`,
            },
          ],
        };
      }
    },
  );
}

export function registerLaunchAppInSimulatorTool(server: McpServer): void {
  server.tool(
    'launch_app_in_simulator',
    "Launches an app in an iOS simulator. IMPORTANT: You MUST provide both the simulatorUuid and bundleId parameters. Example: launch_app_in_simulator({ simulatorUuid: 'YOUR_UUID_HERE', bundleId: 'com.example.MyApp' })",
    {
      simulatorUuid: z
        .string()
        .describe('UUID of the simulator to use (obtained from list_simulators)'),
      bundleId: z
        .string()
        .describe("Bundle identifier of the app to launch (e.g., 'com.example.MyApp')"),
      args: z.array(z.string()).optional().describe('Additional arguments to pass to the app'),
    },
    async (params): Promise<ToolResponse> => {
      const simulatorUuidValidation = validateRequiredParam('simulatorUuid', params.simulatorUuid);
      if (!simulatorUuidValidation.isValid) {
        return simulatorUuidValidation.errorResponse!;
      }

      const bundleIdValidation = validateRequiredParam('bundleId', params.bundleId);
      if (!bundleIdValidation.isValid) {
        return bundleIdValidation.errorResponse!;
      }

      log('info', `Starting xcrun simctl launch request for simulator ${params.simulatorUuid}`);

      try {
        const command = ['xcrun', 'simctl', 'launch', params.simulatorUuid, params.bundleId];

        if (params.args && params.args.length > 0) {
          command.push(...params.args);
        }

        const result = await executeXcodeCommand(command, 'Launch App in Simulator');

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Launch app in simulator operation failed: ${result.error}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `App launched successfully in simulator ${params.simulatorUuid}`,
            },
            {
              type: 'text',
              text: `Next Step: Make sure the Simulator app is open to see the running app: open_simulator({})`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('error', `Error during launch app in simulator operation: ${errorMessage}`);
        return {
          content: [
            {
              type: 'text',
              text: `Launch app in simulator operation failed: ${errorMessage}`,
            },
          ],
        };
      }
    },
  );
}

export function registerOpenSimulatorTool(server: McpServer): void {
  server.tool(
    'open_simulator',
    'Opens the iOS Simulator app. IMPORTANT: You MUST provide an empty object {} as parameters. Example: open_simulator({})',
    {
      _dummy: z
        .boolean()
        .optional()
        .describe(
          'This is a dummy parameter. You must still provide an empty object {}. Example: open_simulator({})',
        ),
    },
    async (): Promise<ToolResponse> => {
      log('info', 'Starting open simulator request');

      try {
        const command = ['open', '-a', 'Simulator'];
        const result = await executeXcodeCommand(command, 'Open Simulator');

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Open simulator operation failed: ${result.error}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Simulator app opened successfully`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('error', `Error during open simulator operation: ${errorMessage}`);
        return {
          content: [
            {
              type: 'text',
              text: `Open simulator operation failed: ${errorMessage}`,
            },
          ],
        };
      }
    },
  );
}
