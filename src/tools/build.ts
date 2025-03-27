/**
 * Build Tool - Uses xcodebuild to build Xcode projects and workspaces
 */

import { z } from 'zod';
import { log } from '../utils/logger.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  executeXcodeCommand,
  addXcodeParameters,
  XcodePlatform,
  constructDestinationString,
} from '../utils/xcode.js';
import {
  validateRequiredParam,
  validateCondition,
  validateAtLeastOneParam,
  createTextResponse,
} from '../utils/validation.js';
import { ToolResponse } from '../types/common.js';
import { execSync } from 'child_process';

/**
 * Enum for simulator platforms used in destination strings
 */
enum _SimulatorPlatform {
  iOS = 'iOS Simulator',
  watchOS = 'watchOS Simulator',
  tvOS = 'tvOS Simulator',
  visionOS = 'visionOS Simulator',
}

/**
 * Register the macOS build tool
 * @param server The MCP server instance
 */
export function registerMacOSBuildTool(server: McpServer): void {
  server.tool(
    'macos_build',
    "Builds a macOS app using xcodebuild. All required parameters for macOS builds are included. Note: All parameters must be provided as an object, even if empty {}. Example: macos_build({ workspacePath: '/path/to/workspace', scheme: 'MyScheme' }) Note: In some environments, this tool may be prefixed as mcp0_macos_build.",
    {
      workspacePath: z.string().optional().describe('Path to the .xcworkspace file'),
      projectPath: z.string().optional().describe('Path to the .xcodeproj file'),
      scheme: z.string().describe('The scheme to build'),
      configuration: z
        .string()
        .default('Debug')
        .describe('Build configuration (Debug, Release, etc.)'),
      derivedDataPath: z
        .string()
        .optional()
        .describe('Path where build products and other derived data will go'),
      extraArgs: z.array(z.string()).optional().describe('Additional xcodebuild arguments'),
    },
    async (params): Promise<ToolResponse> => {
      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) {
        return schemeValidation.errorResponse!;
      }

      const warningMessages = [];
      const pathValidation = validateCondition(
        !!(params.workspacePath || params.projectPath),
        'Neither workspacePath nor projectPath was provided. xcodebuild will look for a project in the current directory.',
      );

      if (!pathValidation.isValid && pathValidation.warningResponse) {
        warningMessages.push(pathValidation.warningResponse.content[0]);
      }

      log('info', `Starting macOS build for scheme ${params.scheme}`);

      try {
        const command = ['xcodebuild'];

        if (params.workspacePath) {
          command.push('-workspace', params.workspacePath);
        }
        if (params.projectPath) {
          command.push('-project', params.projectPath);
        }

        command.push('-scheme', params.scheme);
        command.push('-configuration', params.configuration);
        command.push('-destination', 'platform=macOS');

        if (params.derivedDataPath) {
          command.push('-derivedDataPath', params.derivedDataPath);
        }

        if (params.extraArgs) {
          command.push(...params.extraArgs);
        }

        command.push('build');

        const result = await executeXcodeCommand(command, 'macOS Build');

        if (!result.success) {
          return createTextResponse(`macOS build failed: ${result.error}`, true);
        }

        const appPathMatch = result.output.match(/\/.*\.app/);
        const appBundlePath = appPathMatch ? appPathMatch[0] : null;

        const responseContent = [
          ...warningMessages,
          {
            type: 'text' as const,
            text: `✅ macOS build successful!`,
          },
        ];

        responseContent.push({
          type: 'text' as const,
          text: `Next Steps:
1. Get app path: get_app_path_for_device({ scheme: "${params.scheme}", platform: "${XcodePlatform.macOS}"${params.workspacePath ? `, workspacePath: "${params.workspacePath}"` : ''}${params.projectPath ? `, projectPath: "${params.projectPath}"` : ''} })
2. Launch the app: launch_macos_app({ appPath: "PATH_FROM_ABOVE" })`,
        });

        if (appBundlePath) {
          responseContent.push({
            type: 'text' as const,
            text: `Detected app bundle path: ${appBundlePath}`,
          });
        }

        return {
          content: responseContent,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('error', `Error during macOS build: ${errorMessage}`);

        return createTextResponse(`Error during macOS build: ${errorMessage}`, true);
      }
    },
  );
}

/**
 * Internal function to handle iOS Simulator build logic
 */
async function handleIOSSimulatorBuild(params: {
  workspacePath?: string;
  projectPath?: string;
  scheme: string;
  configuration: string;
  simulatorName?: string;
  simulatorId?: string;
  useLatestOS: boolean;
  derivedDataPath?: string;
  extraArgs?: string[];
}): Promise<ToolResponse> {
  const warningMessages = [];
  const pathValidation = validateCondition(
    !!(params.workspacePath || params.projectPath),
    'Neither workspacePath nor projectPath was provided. xcodebuild will look for a project in the current directory.',
  );

  if (!pathValidation.isValid && pathValidation.warningResponse) {
    warningMessages.push(pathValidation.warningResponse.content[0]);
  }

  log('info', `Starting iOS Simulator build for scheme ${params.scheme}`);

  try {
    const command = ['xcodebuild'];

    if (params.workspacePath) {
      command.push('-workspace', params.workspacePath);
    }
    if (params.projectPath) {
      command.push('-project', params.projectPath);
    }

    command.push('-scheme', params.scheme);
    command.push('-configuration', params.configuration);

    try {
      const destination = constructDestinationString(
        XcodePlatform.iOSSimulator,
        params.simulatorName,
        params.simulatorId,
        params.useLatestOS,
      );
      command.push('-destination', destination);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      warningMessages.push({
        type: 'text' as const,
        text: `Warning: ${errorMessage}. Using default destination.`,
      });
      command.push('-destination', 'platform=iOS Simulator,name=iPhone');
    }

    if (params.derivedDataPath) {
      command.push('-derivedDataPath', params.derivedDataPath);
    }

    if (params.extraArgs) {
      command.push(...params.extraArgs);
    }

    command.push('build');

    const result = await executeXcodeCommand(command, 'iOS Simulator Build');

    if (!result.success) {
      return createTextResponse(`iOS Simulator build failed: ${result.error}`, true);
    }

    const appPathMatch = result.output.match(/\/.*\.app/);
    const appBundlePath = appPathMatch ? appPathMatch[0] : null;

    const responseContent = [
      ...warningMessages,
      {
        type: 'text' as const,
        text: `✅ iOS Simulator build successful!`,
      },
    ];

    responseContent.push({
      type: 'text' as const,
      text: `Next Steps:
1. Get app path: get_app_path_by_name({ scheme: "${params.scheme}", platform: "${XcodePlatform.iOSSimulator}"${params.workspacePath ? `, workspacePath: "${params.workspacePath}"` : ''}${params.projectPath ? `, projectPath: "${params.projectPath}"` : ''} })
2. List simulators: list_simulators({})
3. Boot a simulator: boot_simulator({ simulatorUuid: "UUID_FROM_ABOVE" })
4. Install the app: install_app_in_simulator({ simulatorUuid: "UUID_FROM_ABOVE", appPath: "${appBundlePath}" })`,
    });

    if (appBundlePath) {
      responseContent.push({
        type: 'text' as const,
        text: `Detected app bundle path: ${appBundlePath}`,
      });
    }

    return {
      content: responseContent,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', `Error during iOS Simulator build: ${errorMessage}`);

    return createTextResponse(`Error during iOS Simulator build: ${errorMessage}`, true);
  }
}

/**
 * Register the iOS Simulator build by name tool
 * @param server The MCP server instance
 */
export function registerIOSSimulatorBuildByNameTool(server: McpServer): void {
  server.tool(
    'ios_simulator_build_by_name',
    "Builds an iOS app for a specific simulator by name. IMPORTANT: You MUST provide the simulatorName parameter. Example: ios_simulator_build_by_name({ workspacePath: '/path/to/workspace', scheme: 'MyScheme', simulatorName: 'iPhone 16' }) Note: In some environments, this tool may be prefixed as mcp0_ios_simulator_build_by_name.",
    {
      workspacePath: z.string().optional().describe('Path to the .xcworkspace file'),
      projectPath: z.string().optional().describe('Path to the .xcodeproj file'),
      scheme: z.string().describe('The scheme to build'),
      configuration: z
        .string()
        .default('Debug')
        .describe('Build configuration (Debug, Release, etc.)'),
      simulatorName: z.string().describe("Name of the simulator to use (e.g., 'iPhone 16')"),
      useLatestOS: z
        .boolean()
        .default(true)
        .describe('Whether to use the latest OS version for simulators'),
      derivedDataPath: z
        .string()
        .optional()
        .describe('Path where build products and other derived data will go'),
      extraArgs: z.array(z.string()).optional().describe('Additional xcodebuild arguments'),
    },
    async (params): Promise<ToolResponse> => {
      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) {
        return schemeValidation.errorResponse!;
      }

      const simulatorNameValidation = validateRequiredParam('simulatorName', params.simulatorName);
      if (!simulatorNameValidation.isValid) {
        return simulatorNameValidation.errorResponse!;
      }

      const result = await handleIOSSimulatorBuild({
        workspacePath: params.workspacePath,
        projectPath: params.projectPath,
        scheme: params.scheme,
        configuration: params.configuration,
        simulatorName: params.simulatorName,
        useLatestOS: params.useLatestOS,
        derivedDataPath: params.derivedDataPath,
        extraArgs: params.extraArgs,
      });

      return {
        content: result.content,
      };
    },
  );
}

/**
 * Register the iOS Simulator build by ID tool
 * @param server The MCP server instance
 */
export function registerIOSSimulatorBuildByIdTool(server: McpServer): void {
  server.tool(
    'ios_simulator_build_by_id',
    "Builds an iOS app for a specific simulator by UUID. IMPORTANT: You MUST provide the simulatorId parameter. Example: ios_simulator_build_by_id({ workspacePath: '/path/to/workspace', scheme: 'MyScheme', simulatorId: 'YOUR_UUID_HERE' }) Note: In some environments, this tool may be prefixed as mcp0_ios_simulator_build_by_id.",
    {
      workspacePath: z.string().optional().describe('Path to the .xcworkspace file'),
      projectPath: z.string().optional().describe('Path to the .xcodeproj file'),
      scheme: z.string().describe('The scheme to build'),
      configuration: z
        .string()
        .default('Debug')
        .describe('Build configuration (Debug, Release, etc.)'),
      simulatorId: z
        .string()
        .describe('UUID of the simulator to use (obtained from listSimulators)'),
      useLatestOS: z
        .boolean()
        .default(true)
        .describe('Whether to use the latest OS version for simulators'),
      derivedDataPath: z
        .string()
        .optional()
        .describe('Path where build products and other derived data will go'),
      extraArgs: z.array(z.string()).optional().describe('Additional xcodebuild arguments'),
    },
    async (params): Promise<ToolResponse> => {
      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) {
        return schemeValidation.errorResponse!;
      }

      const simulatorIdValidation = validateRequiredParam('simulatorId', params.simulatorId);
      if (!simulatorIdValidation.isValid) {
        return simulatorIdValidation.errorResponse!;
      }

      const result = await handleIOSSimulatorBuild({
        workspacePath: params.workspacePath,
        projectPath: params.projectPath,
        scheme: params.scheme,
        configuration: params.configuration,
        simulatorId: params.simulatorId,
        useLatestOS: params.useLatestOS,
        derivedDataPath: params.derivedDataPath,
        extraArgs: params.extraArgs,
      });

      return {
        content: result.content,
      };
    },
  );
}

/**
 * Register the iOS Device build tool
 * @param server The MCP server instance
 */
export function registerIOSDeviceBuildTool(server: McpServer): void {
  server.tool(
    'ios_device_build',
    "Builds an iOS app for a physical device using xcodebuild. All required parameters for iOS device builds are included. Note: All parameters must be provided as an object, even if empty {}. Example: ios_device_build({ workspacePath: '/path/to/workspace', scheme: 'MyScheme' }) Note: In some environments, this tool may be prefixed as mcp0_ios_device_build.",
    {
      workspacePath: z.string().optional().describe('Path to the .xcworkspace file'),
      projectPath: z.string().optional().describe('Path to the .xcodeproj file'),
      scheme: z.string().describe('The scheme to build'),
      configuration: z
        .string()
        .default('Debug')
        .describe('Build configuration (Debug, Release, etc.)'),
      derivedDataPath: z
        .string()
        .optional()
        .describe('Path where build products and other derived data will go'),
      extraArgs: z.array(z.string()).optional().describe('Additional xcodebuild arguments'),
    },
    async (params): Promise<ToolResponse> => {
      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) {
        return schemeValidation.errorResponse!;
      }

      const warningMessages = [];
      const pathValidation = validateCondition(
        !!(params.workspacePath || params.projectPath),
        'Neither workspacePath nor projectPath was provided. xcodebuild will look for a project in the current directory.',
      );

      if (!pathValidation.isValid && pathValidation.warningResponse) {
        warningMessages.push(pathValidation.warningResponse.content[0]);
      }

      log('info', `Starting iOS Device build for scheme ${params.scheme}`);

      try {
        const command = ['xcodebuild'];

        if (params.workspacePath) {
          command.push('-workspace', params.workspacePath);
        }
        if (params.projectPath) {
          command.push('-project', params.projectPath);
        }

        command.push('-scheme', params.scheme);
        command.push('-configuration', params.configuration);
        command.push('-destination', 'generic/platform=iOS');

        if (params.derivedDataPath) {
          command.push('-derivedDataPath', params.derivedDataPath);
        }

        if (params.extraArgs) {
          command.push(...params.extraArgs);
        }

        command.push('build');

        const result = await executeXcodeCommand(command, 'iOS Device Build');

        if (!result.success) {
          return createTextResponse(`iOS Device build failed: ${result.error}`, true);
        }

        const appPathMatch = result.output.match(/\/.*\.app/);
        const appBundlePath = appPathMatch ? appPathMatch[0] : null;

        const responseContent = [
          ...warningMessages,
          {
            type: 'text' as const,
            text: `✅ iOS Device build successful!`,
          },
        ];

        responseContent.push({
          type: 'text' as const,
          text: `Next Steps:
1. Get app path: get_app_path_for_device({ scheme: "${params.scheme}", platform: "${XcodePlatform.iOS}"${params.workspacePath ? `, workspacePath: "${params.workspacePath}"` : ''}${params.projectPath ? `, projectPath: "${params.projectPath}"` : ''} })`,
        });

        if (appBundlePath) {
          responseContent.push({
            type: 'text' as const,
            text: `Detected app bundle path: ${appBundlePath}`,
          });
        }

        return {
          content: responseContent,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('error', `Error during iOS Device build: ${errorMessage}`);

        return createTextResponse(`Error during iOS Device build: ${errorMessage}`, true);
      }
    },
  );
}

/**
 * Internal function to handle getting app path logic
 */
async function handleGetAppPath(params: {
  workspacePath?: string;
  projectPath?: string;
  scheme: string;
  configuration: string;
  platform: XcodePlatform;
  simulatorName?: string;
  simulatorId?: string;
  useLatestOS: boolean;
}): Promise<ToolResponse> {
  const warningMessages = [];
  const pathValidation = validateCondition(
    !!(params.workspacePath || params.projectPath),
    'Neither workspacePath nor projectPath was provided. xcodebuild will look for a project in the current directory.',
  );

  if (!pathValidation.isValid && pathValidation.warningResponse) {
    warningMessages.push(pathValidation.warningResponse.content[0]);
  }

  const isSimulatorPlatform = [
    XcodePlatform.iOSSimulator,
    XcodePlatform.watchOSSimulator,
    XcodePlatform.tvOSSimulator,
    XcodePlatform.visionOSSimulator,
  ].includes(params.platform);

  log('info', `Starting get app path for scheme ${params.scheme} on platform ${params.platform}`);

  try {
    const command = ['xcodebuild'];

    if (params.workspacePath) {
      command.push('-workspace', params.workspacePath);
    }
    if (params.projectPath) {
      command.push('-project', params.projectPath);
    }

    command.push('-scheme', params.scheme);
    command.push('-configuration', params.configuration);

    if (isSimulatorPlatform) {
      try {
        const destination = constructDestinationString(
          params.platform,
          params.simulatorName,
          params.simulatorId,
          params.useLatestOS,
        );
        command.push('-destination', destination);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        warningMessages.push({
          type: 'text' as const,
          text: `Warning: ${errorMessage}. Using default destination.`,
        });
        command.push('-destination', 'platform=iOS Simulator,name=iPhone');
      }
    } else {
      command.push('-destination', `platform=${params.platform}`);
    }

    command.push('-showBuildSettings');

    const result = await executeXcodeCommand(command, 'Get App Path');

    if (!result.success) {
      return createTextResponse(`Failed to get app path: ${result.error}`, true);
    }

    const productDirMatch = result.output.match(/BUILT_PRODUCTS_DIR\s*=\s*(.*?)(?:\s|$)/);
    const productNameMatch = result.output.match(/FULL_PRODUCT_NAME\s*=\s*(.*?)(?:\s|$)/);

    if (!productDirMatch || !productDirMatch[1] || !productNameMatch || !productNameMatch[1]) {
      return createTextResponse(
        `Could not extract app path from build settings. Please ensure the scheme is correct and the project builds successfully.`,
        true,
      );
    }

    const appBundlePath = `${productDirMatch[1].trim()}/${productNameMatch[1].trim()}`;
    log('info', `App bundle path: ${appBundlePath}`);

    const responseContent = [
      ...warningMessages,
      {
        type: 'text' as const,
        text: `✅ App bundle path: ${appBundlePath}`,
      },
    ];

    // Add platform-specific next steps
    if (params.platform === XcodePlatform.macOS) {
      responseContent.push({
        type: 'text' as const,
        text: `Next Steps:
1. Launch the app: launch_macos_app({ appPath: "${appBundlePath}" })
2. Get bundle ID: get_macos_bundle_id({ appPath: "${appBundlePath}" })`,
      });
    } else if (isSimulatorPlatform) {
      responseContent.push({
        type: 'text' as const,
        text: `Next Steps:
1. List simulators: list_simulators({})
2. Boot a simulator: boot_simulator({ simulatorUuid: "UUID_FROM_ABOVE" })
3. Install the app: install_app_in_simulator({ simulatorUuid: "UUID_FROM_ABOVE", appPath: "${appBundlePath}" })
4. Get bundle ID: get_ios_bundle_id({ appPath: "${appBundlePath}" })`,
      });
    } else {
      responseContent.push({
        type: 'text' as const,
        text: `Next Steps:
1. Get bundle ID: get_ios_bundle_id({ appPath: "${appBundlePath}" })`,
      });
    }

    return {
      content: responseContent,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', `Error getting app path: ${errorMessage}`);

    return createTextResponse(`Error getting app path: ${errorMessage}`, true);
  }
}

/**
 * Register the get app path by name tool for simulator platforms
 * @param server The MCP server instance
 */
export function registerGetAppPathByNameTool(server: McpServer): void {
  server.tool(
    'get_app_path_by_name',
    "Gets the app bundle path from build settings for simulator platforms using a simulator name. IMPORTANT: You MUST provide the scheme and simulatorName parameters. Example: get_app_path_by_name({ scheme: 'MyScheme', simulatorName: 'iPhone 16', platform: 'iOS Simulator' }) Note: In some environments, this tool may be prefixed as mcp0_get_app_path_by_name.",
    {
      workspacePath: z.string().optional().describe('Optional path to the .xcworkspace file'),
      projectPath: z.string().optional().describe('Optional path to the .xcodeproj file'),
      scheme: z.string().describe('The scheme to get app path for'),
      configuration: z
        .string()
        .default('Debug')
        .describe('Build configuration (Debug, Release, etc.)'),
      platform: z
        .enum([
          XcodePlatform.iOSSimulator,
          XcodePlatform.watchOSSimulator,
          XcodePlatform.tvOSSimulator,
          XcodePlatform.visionOSSimulator,
        ])
        .default(XcodePlatform.iOSSimulator)
        .describe('The target simulator platform to get app path for'),
      simulatorName: z.string().describe("Name of the simulator to use (e.g., 'iPhone 16')"),
    },
    async (params): Promise<ToolResponse> => {
      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) {
        return schemeValidation.errorResponse!;
      }

      const simulatorNameValidation = validateRequiredParam('simulatorName', params.simulatorName);
      if (!simulatorNameValidation.isValid) {
        return simulatorNameValidation.errorResponse!;
      }

      const result = await handleGetAppPath({
        workspacePath: params.workspacePath,
        projectPath: params.projectPath,
        scheme: params.scheme,
        configuration: params.configuration,
        platform: params.platform,
        simulatorName: params.simulatorName,
        useLatestOS: true,
      });

      return {
        content: result.content,
      };
    },
  );
}

/**
 * Register the get app path by ID tool for simulator platforms
 * @param server The MCP server instance
 */
export function registerGetAppPathByIdTool(server: McpServer): void {
  server.tool(
    'get_app_path_by_id',
    "Gets the app bundle path from build settings for simulator platforms using a simulator UUID. IMPORTANT: You MUST provide the scheme and simulatorId parameters. Example: get_app_path_by_id({ scheme: 'MyScheme', simulatorId: 'YOUR_UUID_HERE', platform: 'iOS Simulator' }) Note: In some environments, this tool may be prefixed as mcp0_get_app_path_by_id.",
    {
      workspacePath: z.string().optional().describe('Optional path to the .xcworkspace file'),
      projectPath: z.string().optional().describe('Optional path to the .xcodeproj file'),
      scheme: z.string().describe('The scheme to get app path for'),
      configuration: z
        .string()
        .default('Debug')
        .describe('Build configuration (Debug, Release, etc.)'),
      platform: z
        .enum([
          XcodePlatform.iOSSimulator,
          XcodePlatform.watchOSSimulator,
          XcodePlatform.tvOSSimulator,
          XcodePlatform.visionOSSimulator,
        ])
        .default(XcodePlatform.iOSSimulator)
        .describe('The target simulator platform to get app path for'),
      simulatorId: z
        .string()
        .describe('UUID of the simulator to use (obtained from listSimulators)'),
    },
    async (params): Promise<ToolResponse> => {
      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) {
        return schemeValidation.errorResponse!;
      }

      const simulatorIdValidation = validateRequiredParam('simulatorId', params.simulatorId);
      if (!simulatorIdValidation.isValid) {
        return simulatorIdValidation.errorResponse!;
      }

      const result = await handleGetAppPath({
        workspacePath: params.workspacePath,
        projectPath: params.projectPath,
        scheme: params.scheme,
        configuration: params.configuration,
        platform: params.platform,
        simulatorId: params.simulatorId,
        useLatestOS: false,
      });

      return {
        content: result.content,
      };
    },
  );
}

/**
 * Register the get app path tool for device platforms (non-simulator)
 * @param server The MCP server instance
 */
export function registerGetAppPathForDeviceTool(server: McpServer): void {
  server.tool(
    'get_app_path_for_device',
    "Gets the app bundle path from build settings for device platforms (macOS, iOS, etc.). IMPORTANT: You MUST provide the scheme and platform parameters. Example: get_app_path_for_device({ scheme: 'MyScheme', platform: 'macOS' }) Note: In some environments, this tool may be prefixed as mcp0_get_app_path_for_device.",
    {
      workspacePath: z.string().optional().describe('Optional path to the .xcworkspace file'),
      projectPath: z.string().optional().describe('Optional path to the .xcodeproj file'),
      scheme: z.string().describe('The scheme to get app path for'),
      configuration: z
        .string()
        .default('Debug')
        .describe('Build configuration (Debug, Release, etc.)'),
      platform: z
        .enum([
          XcodePlatform.macOS,
          XcodePlatform.iOS,
          XcodePlatform.watchOS,
          XcodePlatform.tvOS,
          XcodePlatform.visionOS,
        ])
        .describe('The target device platform to get app path for'),
    },
    async (params): Promise<ToolResponse> => {
      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) {
        return schemeValidation.errorResponse!;
      }

      const result = await handleGetAppPath({
        workspacePath: params.workspacePath,
        projectPath: params.projectPath,
        scheme: params.scheme,
        configuration: params.configuration,
        platform: params.platform,
        useLatestOS: true,
      });

      return {
        content: result.content,
      };
    },
  );
}

/**
 * Register the show build settings tool
 * @param server The MCP server instance
 */
export function registerShowBuildSettingsTool(server: McpServer): void {
  server.tool(
    'show_build_settings',
    "Shows build settings for the project using xcodebuild. IMPORTANT: You MUST provide the scheme parameter. Example: show_build_settings({ scheme: 'MyScheme', workspacePath: '/path/to/workspace' }) Note: In some environments, this tool may be prefixed as mcp0_show_build_settings.",
    {
      workspacePath: z.string().optional().describe('Optional path to the .xcworkspace file'),
      projectPath: z.string().optional().describe('Optional path to the .xcodeproj file'),
      scheme: z.string().describe('The scheme to show build settings for'),
    },
    async (params): Promise<ToolResponse> => {
      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) {
        return schemeValidation.errorResponse!;
      }

      const warningMessages = [];
      const pathValidation = validateCondition(
        !!(params.workspacePath || params.projectPath),
        'Neither workspacePath nor projectPath was provided. xcodebuild will look for a project in the current directory.',
      );

      if (!pathValidation.isValid && pathValidation.warningResponse) {
        warningMessages.push(pathValidation.warningResponse.content[0]);
      }

      log('info', 'Starting xcodebuild show build settings request');

      try {
        const command = ['xcodebuild'];
        addXcodeParameters(command, params, 'Showing Build Settings');
        command.push('-showBuildSettings');

        const result = await executeXcodeCommand(command, 'Show Build Settings');

        if (!result.success) {
          return createTextResponse(`Show build settings operation failed: ${result.error}`, true);
        }

        const responseContent = [
          ...warningMessages,
          {
            type: 'text' as const,
            text: `✅ Build settings for scheme '${params.scheme}':\n${result.output}`,
          },
        ];

        return {
          content: responseContent,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('error', `Error during show build settings operation: ${errorMessage}`);
        return createTextResponse(`Show build settings operation failed: ${errorMessage}`, true);
      }
    },
  );
}

/**
 * Register the list simulators tool
 * @param server The MCP server instance
 */
export function registerListSchemesTool(server: McpServer): void {
  server.tool(
    'list_schemes',
    "Lists available schemes in the project. IMPORTANT: You MUST provide either workspacePath or projectPath. Example: list_schemes({ workspacePath: '/path/to/workspace' }) Note: In some environments, this tool may be prefixed as mcp0_list_schemes.",
    {
      workspacePath: z.string().optional().describe('Path to the .xcworkspace file'),
      projectPath: z.string().optional().describe('Path to the .xcodeproj file'),
    },
    async (params): Promise<ToolResponse> => {
      const pathValidation = validateAtLeastOneParam(
        'workspacePath',
        params.workspacePath,
        'projectPath',
        params.projectPath,
      );
      if (!pathValidation.isValid) {
        return pathValidation.errorResponse!;
      }

      log('info', 'Starting list schemes request');

      try {
        const command = ['xcodebuild'];

        if (params.workspacePath) {
          command.push('-workspace', params.workspacePath);
        }
        if (params.projectPath) {
          command.push('-project', params.projectPath);
        }

        command.push('-list');

        const result = await executeXcodeCommand(command, 'List Schemes');

        if (!result.success) {
          return createTextResponse(`List schemes operation failed: ${result.error}`, true);
        }

        const schemesMatch = result.output.match(/Schemes:\s*(.*)/);
        const schemes = schemesMatch ? schemesMatch[1].trim().split('\n') : [];

        let responseText = `Available schemes:\n`;

        for (const scheme of schemes) {
          responseText += `- ${scheme}\n`;
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: responseText,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('error', `Error during list schemes operation: ${errorMessage}`);
        return createTextResponse(`List schemes operation failed: ${errorMessage}`, true);
      }
    },
  );
}

/**
 * Register the macOS build and run tool
 * @param server The MCP server instance
 */
export function registerMacOSBuildAndRunTool(server: McpServer): void {
  server.tool(
    'macos_build_and_run',
    "Builds and runs a macOS app in one step. IMPORTANT: You MUST provide the scheme parameter. Example: macos_build_and_run({ workspacePath: '/path/to/workspace', scheme: 'MyScheme' }) Note: In some environments, this tool may be prefixed as mcp0_macos_build_and_run.",
    {
      workspacePath: z.string().optional().describe('Path to the .xcworkspace file'),
      projectPath: z.string().optional().describe('Path to the .xcodeproj file'),
      scheme: z.string().describe('The scheme to build and run'),
      configuration: z
        .string()
        .default('Debug')
        .describe('Build configuration (Debug, Release, etc.)'),
      derivedDataPath: z
        .string()
        .optional()
        .describe('Path where build products and other derived data will go'),
      extraArgs: z.array(z.string()).optional().describe('Additional xcodebuild arguments'),
    },
    async (params): Promise<ToolResponse> => {
      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) {
        return schemeValidation.errorResponse!;
      }

      log('info', `Starting macOS build and run for scheme ${params.scheme}`);

      try {
        const buildCommand = ['xcodebuild'];

        if (params.workspacePath) {
          buildCommand.push('-workspace', params.workspacePath);
        }
        if (params.projectPath) {
          buildCommand.push('-project', params.projectPath);
        }

        buildCommand.push('-scheme', params.scheme);
        buildCommand.push('-configuration', params.configuration);
        buildCommand.push('-destination', 'platform=macOS');

        if (params.derivedDataPath) {
          buildCommand.push('-derivedDataPath', params.derivedDataPath);
        }

        if (params.extraArgs) {
          buildCommand.push(...params.extraArgs);
        }

        buildCommand.push('build');

        const buildResult = await executeXcodeCommand(buildCommand, 'macOS Build');

        if (!buildResult.success) {
          return createTextResponse(`macOS build failed: ${buildResult.error}`, true);
        }

        const appPathCommand = ['xcodebuild'];

        if (params.workspacePath) {
          appPathCommand.push('-workspace', params.workspacePath);
        }
        if (params.projectPath) {
          appPathCommand.push('-project', params.projectPath);
        }

        appPathCommand.push('-scheme', params.scheme);
        appPathCommand.push('-configuration', params.configuration);
        appPathCommand.push('-destination', 'platform=macOS');
        appPathCommand.push('-showBuildSettings');

        const appPathResult = await executeXcodeCommand(appPathCommand, 'Get App Path');

        if (!appPathResult.success) {
          return createTextResponse(`Failed to get app path: ${appPathResult.error}`, true);
        }

        const productDirMatch = appPathResult.output.match(
          /BUILT_PRODUCTS_DIR\s*=\s*(.*?)(?:\s|$)/,
        );
        const productNameMatch = appPathResult.output.match(
          /FULL_PRODUCT_NAME\s*=\s*(.*?)(?:\s|$)/,
        );

        if (!productDirMatch || !productDirMatch[1] || !productNameMatch || !productNameMatch[1]) {
          return createTextResponse(
            `Could not extract app path from build settings. Please ensure the scheme is correct and the project builds successfully.`,
            true,
          );
        }

        const appBundlePath = `${productDirMatch[1].trim()}/${productNameMatch[1].trim()}`;
        log('info', `App bundle path: ${appBundlePath}`);

        try {
          execSync(`open "${appBundlePath}"`);

          return {
            content: [
              {
                type: 'text' as const,
                text: `✅ Successfully built and launched macOS app: ${appBundlePath}`,
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return createTextResponse(`Error launching macOS app: ${errorMessage}`, true);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('error', `Error during macOS build and run: ${errorMessage}`);

        return createTextResponse(`macOS build and run failed: ${errorMessage}`, true);
      }
    },
  );
}

/**
 * Register the iOS Simulator build and run tool
 * @param server The MCP server instance
 */
export function registerIOSSimulatorBuildAndRunByNameTool(server: McpServer): void {
  server.tool(
    'ios_simulator_build_and_run_by_name',
    "Builds and runs an iOS app on a simulator in one step. All required parameters for iOS Simulator are included. Note: All parameters must be provided as an object, even if empty {}. Example: ios_simulator_build_and_run_by_name({ workspacePath: '/path/to/workspace', scheme: 'MyScheme', simulatorName: 'iPhone 16' })",
    {
      workspacePath: z.string().optional().describe('Path to the .xcworkspace file'),
      projectPath: z.string().optional().describe('Path to the .xcodeproj file'),
      scheme: z.string().describe('The scheme to build and run'),
      configuration: z
        .string()
        .default('Debug')
        .describe('Build configuration (Debug, Release, etc.)'),
      simulatorName: z.string().describe("Name of the simulator to use (e.g., 'iPhone 16')"),
      useLatestOS: z
        .boolean()
        .default(true)
        .describe('Whether to use the latest OS version for simulators'),
      derivedDataPath: z
        .string()
        .optional()
        .describe('Path where build products and other derived data will go'),
      extraArgs: z.array(z.string()).optional().describe('Additional xcodebuild arguments'),
    },
    async (params): Promise<ToolResponse> => {
      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) {
        return schemeValidation.errorResponse!;
      }

      log('info', `Starting iOS Simulator build and run for scheme ${params.scheme}`);

      try {
        const buildCommand = ['xcodebuild'];

        if (params.workspacePath) {
          buildCommand.push('-workspace', params.workspacePath);
        }
        if (params.projectPath) {
          buildCommand.push('-project', params.projectPath);
        }

        buildCommand.push('-scheme', params.scheme);
        buildCommand.push('-configuration', params.configuration);

        try {
          const destination = constructDestinationString(
            XcodePlatform.iOSSimulator,
            params.simulatorName,
            undefined,
            params.useLatestOS,
          );
          buildCommand.push('-destination', destination);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log('warning', `Failed to construct destination string: ${errorMessage}`);
          buildCommand.push('-destination', 'platform=iOS Simulator,name=iPhone');
        }

        if (params.derivedDataPath) {
          buildCommand.push('-derivedDataPath', params.derivedDataPath);
        }

        if (params.extraArgs) {
          buildCommand.push(...params.extraArgs);
        }

        buildCommand.push('build');

        const buildResult = await executeXcodeCommand(buildCommand, 'iOS Simulator Build');

        if (!buildResult.success) {
          return createTextResponse(`iOS Simulator build failed: ${buildResult.error}`, true);
        }

        const appPathCommand = ['xcodebuild'];

        if (params.workspacePath) {
          appPathCommand.push('-workspace', params.workspacePath);
        }
        if (params.projectPath) {
          appPathCommand.push('-project', params.projectPath);
        }

        appPathCommand.push('-scheme', params.scheme);
        appPathCommand.push('-configuration', params.configuration);

        try {
          const destination = constructDestinationString(
            XcodePlatform.iOSSimulator,
            params.simulatorName,
            undefined,
            params.useLatestOS,
          );
          appPathCommand.push('-destination', destination);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log('warning', `Failed to construct destination string: ${errorMessage}`);
          appPathCommand.push('-destination', 'platform=iOS Simulator,name=iPhone');
        }

        appPathCommand.push('-showBuildSettings');

        const appPathResult = await executeXcodeCommand(appPathCommand, 'Get App Path');

        if (!appPathResult.success) {
          return createTextResponse(`Failed to get app path: ${appPathResult.error}`, true);
        }

        const productDirMatch = appPathResult.output.match(
          /BUILT_PRODUCTS_DIR\s*=\s*(.*?)(?:\s|$)/,
        );
        const productNameMatch = appPathResult.output.match(
          /FULL_PRODUCT_NAME\s*=\s*(.*?)(?:\s|$)/,
        );

        if (!productDirMatch || !productDirMatch[1] || !productNameMatch || !productNameMatch[1]) {
          return createTextResponse(
            `Could not extract app path from build settings. Please ensure the scheme is correct and the project builds successfully.`,
            true,
          );
        }

        const appBundlePath = `${productDirMatch[1].trim()}/${productNameMatch[1].trim()}`;
        log('info', `App bundle path: ${appBundlePath}`);

        let simulatorUuid = undefined;

        try {
          const simulatorsOutput = execSync('xcrun simctl list devices --json').toString();
          const simulatorsJson = JSON.parse(simulatorsOutput);

          let foundSimulator = null;

          for (const runtime in simulatorsJson.devices) {
            const devices = simulatorsJson.devices[runtime];

            for (const device of devices) {
              if (params.simulatorName) {
                if (device.name === params.simulatorName && device.isAvailable) {
                  foundSimulator = device;
                  break;
                }
              } else if (device.name.includes('iPhone') && device.isAvailable) {
                foundSimulator = device;
                break;
              }
            }

            if (foundSimulator) break;
          }

          if (foundSimulator) {
            simulatorUuid = foundSimulator.udid;
            log('info', `Found simulator: ${foundSimulator.name} (${simulatorUuid})`);
          } else {
            return createTextResponse(
              `Could not find a suitable simulator. Please specify a simulatorId or simulatorName.`,
              true,
            );
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return createTextResponse(`Error finding simulator: ${errorMessage}`, true);
        }

        try {
          const simulatorStateOutput = execSync(
            `xcrun simctl list devices | grep ${simulatorUuid}`,
          ).toString();
          const isBooted = simulatorStateOutput.includes('Booted');

          if (!isBooted) {
            log('info', 'Booting simulator');
            execSync(`xcrun simctl boot ${simulatorUuid}`);
          } else {
            log('info', 'Simulator is already booted');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return createTextResponse(`Error booting simulator: ${errorMessage}`, true);
        }

        try {
          execSync(`xcrun simctl install ${simulatorUuid} "${appBundlePath}"`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return createTextResponse(`Error installing app on simulator: ${errorMessage}`, true);
        }

        let bundleId;
        try {
          bundleId = execSync(`defaults read "${appBundlePath}/Info" CFBundleIdentifier`)
            .toString()
            .trim();
          log('info', `Bundle ID: ${bundleId}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return createTextResponse(`Error getting bundle ID: ${errorMessage}`, true);
        }

        try {
          execSync(`xcrun simctl launch ${simulatorUuid} ${bundleId}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return createTextResponse(`Error launching app on simulator: ${errorMessage}`, true);
        }

        try {
          execSync('open -a Simulator');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log('warning', `Warning: Could not open Simulator app: ${errorMessage}`);
          // Continue anyway since the app is already installed and launched
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `✅ Successfully built and launched app on iOS Simulator:
- App: ${appBundlePath}
- Bundle ID: ${bundleId}
- Simulator: ${simulatorUuid}

The app should now be running in the iOS Simulator.`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('error', `Error in iOS Simulator build and run: ${errorMessage}`);

        return createTextResponse(`Error in iOS Simulator build and run: ${errorMessage}`, true);
      }
    },
  );
}

/**
 * Register the iOS Simulator build and run tool
 * @param server The MCP server instance
 */
export function registerIOSSimulatorBuildAndRunByIdTool(server: McpServer): void {
  server.tool(
    'ios_simulator_build_and_run_by_id',
    "Builds and runs an iOS app on a simulator in one step. All required parameters for iOS Simulator are included. Note: All parameters must be provided as an object, even if empty {}. Example: ios_simulator_build_and_run_by_id({ workspacePath: '/path/to/workspace', scheme: 'MyScheme', simulatorId: 'YOUR_UUID_HERE' })",
    {
      workspacePath: z.string().optional().describe('Path to the .xcworkspace file'),
      projectPath: z.string().optional().describe('Path to the .xcodeproj file'),
      scheme: z.string().describe('The scheme to build and run'),
      configuration: z
        .string()
        .default('Debug')
        .describe('Build configuration (Debug, Release, etc.)'),
      simulatorId: z
        .string()
        .describe('UUID of the simulator to use (obtained from listSimulators)'),
      useLatestOS: z
        .boolean()
        .default(true)
        .describe('Whether to use the latest OS version for simulators'),
      derivedDataPath: z
        .string()
        .optional()
        .describe('Path where build products and other derived data will go'),
      extraArgs: z.array(z.string()).optional().describe('Additional xcodebuild arguments'),
    },
    async (params): Promise<ToolResponse> => {
      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) {
        return schemeValidation.errorResponse!;
      }

      log('info', `Starting iOS Simulator build and run for scheme ${params.scheme}`);

      try {
        const buildCommand = ['xcodebuild'];

        if (params.workspacePath) {
          buildCommand.push('-workspace', params.workspacePath);
        }
        if (params.projectPath) {
          buildCommand.push('-project', params.projectPath);
        }

        buildCommand.push('-scheme', params.scheme);
        buildCommand.push('-configuration', params.configuration);

        try {
          const destination = constructDestinationString(
            XcodePlatform.iOSSimulator,
            undefined,
            params.simulatorId,
            params.useLatestOS,
          );
          buildCommand.push('-destination', destination);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log('warning', `Failed to construct destination string: ${errorMessage}`);
          buildCommand.push('-destination', 'platform=iOS Simulator,name=iPhone');
        }

        if (params.derivedDataPath) {
          buildCommand.push('-derivedDataPath', params.derivedDataPath);
        }

        if (params.extraArgs) {
          buildCommand.push(...params.extraArgs);
        }

        buildCommand.push('build');

        const buildResult = await executeXcodeCommand(buildCommand, 'iOS Simulator Build');

        if (!buildResult.success) {
          return createTextResponse(`iOS Simulator build failed: ${buildResult.error}`, true);
        }

        const appPathCommand = ['xcodebuild'];

        if (params.workspacePath) {
          appPathCommand.push('-workspace', params.workspacePath);
        }
        if (params.projectPath) {
          appPathCommand.push('-project', params.projectPath);
        }

        appPathCommand.push('-scheme', params.scheme);
        appPathCommand.push('-configuration', params.configuration);

        try {
          const destination = constructDestinationString(
            XcodePlatform.iOSSimulator,
            undefined,
            params.simulatorId,
            params.useLatestOS,
          );
          appPathCommand.push('-destination', destination);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log('warning', `Failed to construct destination string: ${errorMessage}`);
          appPathCommand.push('-destination', 'platform=iOS Simulator,name=iPhone');
        }

        appPathCommand.push('-showBuildSettings');

        const appPathResult = await executeXcodeCommand(appPathCommand, 'Get App Path');

        if (!appPathResult.success) {
          return createTextResponse(`Failed to get app path: ${appPathResult.error}`, true);
        }

        const productDirMatch = appPathResult.output.match(
          /BUILT_PRODUCTS_DIR\s*=\s*(.*?)(?:\s|$)/,
        );
        const productNameMatch = appPathResult.output.match(
          /FULL_PRODUCT_NAME\s*=\s*(.*?)(?:\s|$)/,
        );

        if (!productDirMatch || !productDirMatch[1] || !productNameMatch || !productNameMatch[1]) {
          return createTextResponse(
            `Could not extract app path from build settings. Please ensure the scheme is correct and the project builds successfully.`,
            true,
          );
        }

        const appBundlePath = `${productDirMatch[1].trim()}/${productNameMatch[1].trim()}`;
        log('info', `App bundle path: ${appBundlePath}`);

        try {
          const simulatorStateOutput = execSync(
            `xcrun simctl list devices | grep ${params.simulatorId}`,
          ).toString();
          const isBooted = simulatorStateOutput.includes('Booted');

          if (!isBooted) {
            log('info', 'Booting simulator');
            execSync(`xcrun simctl boot ${params.simulatorId}`);
          } else {
            log('info', 'Simulator is already booted');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return createTextResponse(`Error booting simulator: ${errorMessage}`, true);
        }

        try {
          execSync(`xcrun simctl install ${params.simulatorId} "${appBundlePath}"`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return createTextResponse(`Error installing app on simulator: ${errorMessage}`, true);
        }

        let bundleId;
        try {
          bundleId = execSync(`defaults read "${appBundlePath}/Info" CFBundleIdentifier`)
            .toString()
            .trim();
          log('info', `Bundle ID: ${bundleId}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return createTextResponse(`Error getting bundle ID: ${errorMessage}`, true);
        }

        try {
          execSync(`xcrun simctl launch ${params.simulatorId} ${bundleId}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return createTextResponse(`Error launching app on simulator: ${errorMessage}`, true);
        }

        try {
          execSync('open -a Simulator');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log('warning', `Warning: Could not open Simulator app: ${errorMessage}`);
          // Continue anyway since the app is already installed and launched
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `✅ Successfully built and launched app on iOS Simulator:
- App: ${appBundlePath}
- Bundle ID: ${bundleId}
- Simulator: ${params.simulatorId}

The app should now be running in the iOS Simulator.`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('error', `Error in iOS Simulator build and run: ${errorMessage}`);

        return createTextResponse(`Error in iOS Simulator build and run: ${errorMessage}`, true);
      }
    },
  );
}
