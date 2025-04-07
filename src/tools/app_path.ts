/**
 * App Path Tools - Tools for retrieving app bundle paths
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { log } from '../utils/logger.js';
import { validateRequiredParam, createTextResponse } from '../utils/validation.js';
import { ToolResponse, XcodePlatform } from '../types/common.js';
import { executeXcodeBuild } from '../utils/build-utils.js';
import {
  registerTool,
  workspacePathSchema,
  projectPathSchema,
  schemeSchema,
  configurationSchema,
  simulatorNameSchema,
  simulatorIdSchema,
  useLatestOSSchema,
  platformSimulatorSchema,
  BaseWorkspaceParams,
  BaseProjectParams,
  BaseAppPathSimulatorNameParams,
  BaseAppPathSimulatorIdParams,
} from './common.js';

// --- Private Helper Functions ---

/**
 * Internal function to handle getting app path
 */
async function _handleGetAppPathLogic(params: {
  workspacePath?: string;
  projectPath?: string;
  scheme: string;
  configuration: string;
  platform: XcodePlatform;
  simulatorName?: string;
  simulatorId?: string;
  useLatestOS: boolean;
}): Promise<ToolResponse> {
  log('info', `Getting app path for scheme ${params.scheme} on platform ${params.platform}`);

  try {
    // Use executeXcodeBuild with 'showBuildSettings' action for consistent error handling
    const result = await executeXcodeBuild(
      {
        ...params,
      },
      {
        platform: params.platform,
        simulatorName: params.simulatorName,
        simulatorId: params.simulatorId,
        useLatestOS: params.useLatestOS,
        logPrefix: 'Get App Path',
      },
      'showBuildSettings',
    );

    // If executeXcodeBuild returned an error, just return it
    if (result.isError) {
      return result;
    }

    // Extract the build settings output from the result
    let buildSettingsOutput = '';
    if (result.content) {
      for (const item of result.content) {
        if (item.type === 'text' && !item.text.includes('✅') && !item.text.includes('⚠️')) {
          buildSettingsOutput = item.text;
          break;
        }
      }
    }

    if (!buildSettingsOutput) {
      return createTextResponse('Failed to extract build settings output from the result.', true);
    }

    const builtProductsDirMatch = buildSettingsOutput.match(/BUILT_PRODUCTS_DIR = (.+)$/m);
    const fullProductNameMatch = buildSettingsOutput.match(/FULL_PRODUCT_NAME = (.+)$/m);

    if (!builtProductsDirMatch || !fullProductNameMatch) {
      return createTextResponse(
        'Failed to extract app path from build settings. Make sure the app has been built first.',
        true,
      );
    }

    const builtProductsDir = builtProductsDirMatch[1].trim();
    const fullProductName = fullProductNameMatch[1].trim();
    const appPath = `${builtProductsDir}/${fullProductName}`;

    let nextStepsText = '';
    if (params.platform === XcodePlatform.macOS) {
      nextStepsText = `Next Steps:
1. Get bundle ID: get_macos_bundle_id({ appPath: "${appPath}" })
2. Launch the app: launch_macos_app({ appPath: "${appPath}" })`;
    } else if (params.platform === XcodePlatform.iOSSimulator) {
      nextStepsText = `Next Steps:
1. Get bundle ID: get_ios_bundle_id({ appPath: "${appPath}" })
2. Boot simulator: boot_simulator({ simulatorUuid: "SIMULATOR_UUID" })
3. Install app: install_app_in_simulator({ simulatorUuid: "SIMULATOR_UUID", appPath: "${appPath}" })
4. Launch app: launch_app_in_simulator({ simulatorUuid: "SIMULATOR_UUID", bundleId: "BUNDLE_ID" })`;
    } else if (params.platform === XcodePlatform.iOS) {
      nextStepsText = `Next Steps:
1. Get bundle ID: get_ios_bundle_id({ appPath: "${appPath}" })
2. Use Xcode to install the app on your connected iOS device`;
    }

    return {
      content: [
        {
          type: 'text',
          text: `✅ App path retrieved successfully: ${appPath}`,
        },
        {
          type: 'text',
          text: nextStepsText,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', `Error retrieving app path: ${errorMessage}`);
    return createTextResponse(`Error retrieving app path: ${errorMessage}`, true);
  }
}

// --- Public Tool Definitions ---

/**
 * Registers the get_macos_app_path_workspace tool
 */
export function registerGetMacOSAppPathWorkspaceTool(server: McpServer): void {
  type Params = BaseWorkspaceParams & { configuration?: string };
  registerTool<Params>(
    server,
    'get_macos_app_path_workspace',
    "Gets the app bundle path for a macOS application using a workspace. IMPORTANT: Requires workspacePath and scheme. Example: get_macos_app_path_workspace({ workspacePath: '/path/to/workspace', scheme: 'MyScheme' })",
    {
      workspacePath: workspacePathSchema,
      scheme: schemeSchema,
      configuration: configurationSchema,
    },
    async (params: Params) => {
      const workspaceValidation = validateRequiredParam('workspacePath', params.workspacePath);
      if (!workspaceValidation.isValid) return workspaceValidation.errorResponse!;

      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) return schemeValidation.errorResponse!;

      return _handleGetAppPathLogic({
        ...params,
        configuration: params.configuration ?? 'Debug',
        platform: XcodePlatform.macOS,
        useLatestOS: true,
      });
    },
  );
}

/**
 * Registers the get_macos_app_path_project tool
 */
export function registerGetMacOSAppPathProjectTool(server: McpServer): void {
  type Params = BaseProjectParams & { configuration?: string };
  registerTool<Params>(
    server,
    'get_macos_app_path_project',
    "Gets the app bundle path for a macOS application using a project file. IMPORTANT: Requires projectPath and scheme. Example: get_macos_app_path_project({ projectPath: '/path/to/project.xcodeproj', scheme: 'MyScheme' })",
    {
      projectPath: projectPathSchema,
      scheme: schemeSchema,
      configuration: configurationSchema,
    },
    async (params: Params) => {
      const projectValidation = validateRequiredParam('projectPath', params.projectPath);
      if (!projectValidation.isValid) return projectValidation.errorResponse!;

      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) return schemeValidation.errorResponse!;

      return _handleGetAppPathLogic({
        ...params,
        configuration: params.configuration ?? 'Debug',
        platform: XcodePlatform.macOS,
        useLatestOS: true,
      });
    },
  );
}

/**
 * Registers the get_ios_device_app_path_workspace tool
 */
export function registerGetiOSDeviceAppPathWorkspaceTool(server: McpServer): void {
  type Params = BaseWorkspaceParams & { configuration?: string };
  registerTool<Params>(
    server,
    'get_ios_device_app_path_workspace',
    "Gets the app bundle path for an iOS physical device application using a workspace. IMPORTANT: Requires workspacePath and scheme. Example: get_ios_device_app_path_workspace({ workspacePath: '/path/to/workspace', scheme: 'MyScheme' })",
    {
      workspacePath: workspacePathSchema,
      scheme: schemeSchema,
      configuration: configurationSchema,
    },
    async (params: Params) => {
      const workspaceValidation = validateRequiredParam('workspacePath', params.workspacePath);
      if (!workspaceValidation.isValid) return workspaceValidation.errorResponse!;

      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) return schemeValidation.errorResponse!;

      return _handleGetAppPathLogic({
        ...params,
        configuration: params.configuration ?? 'Debug',
        platform: XcodePlatform.iOS,
        useLatestOS: true,
      });
    },
  );
}

/**
 * Registers the get_ios_device_app_path_project tool
 */
export function registerGetiOSDeviceAppPathProjectTool(server: McpServer): void {
  type Params = BaseProjectParams & { configuration?: string };
  registerTool<Params>(
    server,
    'get_ios_device_app_path_project',
    "Gets the app bundle path for an iOS physical device application using a project file. IMPORTANT: Requires projectPath and scheme. Example: get_ios_device_app_path_project({ projectPath: '/path/to/project.xcodeproj', scheme: 'MyScheme' })",
    {
      projectPath: projectPathSchema,
      scheme: schemeSchema,
      configuration: configurationSchema,
    },
    async (params: Params) => {
      const projectValidation = validateRequiredParam('projectPath', params.projectPath);
      if (!projectValidation.isValid) return projectValidation.errorResponse!;

      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) return schemeValidation.errorResponse!;

      return _handleGetAppPathLogic({
        ...params,
        configuration: params.configuration ?? 'Debug',
        platform: XcodePlatform.iOS,
        useLatestOS: true,
      });
    },
  );
}

/**
 * Registers the get_simulator_app_path_by_name_workspace tool
 */
export function registerGetSimulatorAppPathByNameWorkspaceTool(server: McpServer): void {
  type Params = BaseWorkspaceParams & BaseAppPathSimulatorNameParams;
  registerTool<Params>(
    server,
    'get_simulator_app_path_by_name_workspace',
    "Gets the app bundle path for a simulator by name using a workspace. IMPORTANT: Requires workspacePath, scheme, platform, and simulatorName. Example: get_simulator_app_path_by_name_workspace({ workspacePath: '/path/to/workspace', scheme: 'MyScheme', platform: 'iOS Simulator', simulatorName: 'iPhone 16' })",
    {
      workspacePath: workspacePathSchema,
      scheme: schemeSchema,
      platform: platformSimulatorSchema,
      simulatorName: simulatorNameSchema,
      configuration: configurationSchema,
      useLatestOS: useLatestOSSchema,
    },
    async (params: Params) => {
      const workspaceValidation = validateRequiredParam('workspacePath', params.workspacePath);
      if (!workspaceValidation.isValid) return workspaceValidation.errorResponse!;

      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) return schemeValidation.errorResponse!;

      const platformValidation = validateRequiredParam('platform', params.platform);
      if (!platformValidation.isValid) return platformValidation.errorResponse!;

      const simulatorNameValidation = validateRequiredParam('simulatorName', params.simulatorName);
      if (!simulatorNameValidation.isValid) return simulatorNameValidation.errorResponse!;

      return _handleGetAppPathLogic({
        ...params,
        configuration: params.configuration ?? 'Debug',
        useLatestOS: params.useLatestOS ?? true,
      });
    },
  );
}

/**
 * Registers the get_simulator_app_path_by_name_project tool
 */
export function registerGetSimulatorAppPathByNameProjectTool(server: McpServer): void {
  type Params = BaseProjectParams & BaseAppPathSimulatorNameParams;
  registerTool<Params>(
    server,
    'get_simulator_app_path_by_name_project',
    "Gets the app bundle path for a simulator by name using a project file. IMPORTANT: Requires projectPath, scheme, platform, and simulatorName. Example: get_simulator_app_path_by_name_project({ projectPath: '/path/to/project.xcodeproj', scheme: 'MyScheme', platform: 'iOS Simulator', simulatorName: 'iPhone 16' })",
    {
      projectPath: projectPathSchema,
      scheme: schemeSchema,
      platform: platformSimulatorSchema,
      simulatorName: simulatorNameSchema,
      configuration: configurationSchema,
      useLatestOS: useLatestOSSchema,
    },
    async (params: Params) => {
      const projectValidation = validateRequiredParam('projectPath', params.projectPath);
      if (!projectValidation.isValid) return projectValidation.errorResponse!;

      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) return schemeValidation.errorResponse!;

      const platformValidation = validateRequiredParam('platform', params.platform);
      if (!platformValidation.isValid) return platformValidation.errorResponse!;

      const simulatorNameValidation = validateRequiredParam('simulatorName', params.simulatorName);
      if (!simulatorNameValidation.isValid) return simulatorNameValidation.errorResponse!;

      return _handleGetAppPathLogic({
        ...params,
        configuration: params.configuration ?? 'Debug',
        useLatestOS: params.useLatestOS ?? true,
      });
    },
  );
}

/**
 * Registers the get_simulator_app_path_by_id_workspace tool
 */
export function registerGetSimulatorAppPathByIdWorkspaceTool(server: McpServer): void {
  type Params = BaseWorkspaceParams & BaseAppPathSimulatorIdParams;
  registerTool<Params>(
    server,
    'get_simulator_app_path_by_id_workspace',
    "Gets the app bundle path for a simulator by UUID using a workspace. IMPORTANT: Requires workspacePath, scheme, platform, and simulatorId. Example: get_simulator_app_path_by_id_workspace({ workspacePath: '/path/to/workspace', scheme: 'MyScheme', platform: 'iOS Simulator', simulatorId: 'SIMULATOR_UUID' })",
    {
      workspacePath: workspacePathSchema,
      scheme: schemeSchema,
      platform: platformSimulatorSchema,
      simulatorId: simulatorIdSchema,
      configuration: configurationSchema,
      useLatestOS: useLatestOSSchema,
    },
    async (params: Params) => {
      const workspaceValidation = validateRequiredParam('workspacePath', params.workspacePath);
      if (!workspaceValidation.isValid) return workspaceValidation.errorResponse!;

      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) return schemeValidation.errorResponse!;

      const platformValidation = validateRequiredParam('platform', params.platform);
      if (!platformValidation.isValid) return platformValidation.errorResponse!;

      const simulatorIdValidation = validateRequiredParam('simulatorId', params.simulatorId);
      if (!simulatorIdValidation.isValid) return simulatorIdValidation.errorResponse!;

      return _handleGetAppPathLogic({
        ...params,
        configuration: params.configuration ?? 'Debug',
        useLatestOS: params.useLatestOS ?? true,
      });
    },
  );
}

/**
 * Registers the get_simulator_app_path_by_id_project tool
 */
export function registerGetSimulatorAppPathByIdProjectTool(server: McpServer): void {
  type Params = BaseProjectParams & BaseAppPathSimulatorIdParams;
  registerTool<Params>(
    server,
    'get_simulator_app_path_by_id_project',
    "Gets the app bundle path for a simulator by UUID using a project file. IMPORTANT: Requires projectPath, scheme, platform, and simulatorId. Example: get_simulator_app_path_by_id_project({ projectPath: '/path/to/project.xcodeproj', scheme: 'MyScheme', platform: 'iOS Simulator', simulatorId: 'SIMULATOR_UUID' })",
    {
      projectPath: projectPathSchema,
      scheme: schemeSchema,
      platform: platformSimulatorSchema,
      simulatorId: simulatorIdSchema,
      configuration: configurationSchema,
      useLatestOS: useLatestOSSchema,
    },
    async (params: Params) => {
      const projectValidation = validateRequiredParam('projectPath', params.projectPath);
      if (!projectValidation.isValid) return projectValidation.errorResponse!;

      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) return schemeValidation.errorResponse!;

      const platformValidation = validateRequiredParam('platform', params.platform);
      if (!platformValidation.isValid) return platformValidation.errorResponse!;

      const simulatorIdValidation = validateRequiredParam('simulatorId', params.simulatorId);
      if (!simulatorIdValidation.isValid) return simulatorIdValidation.errorResponse!;

      return _handleGetAppPathLogic({
        ...params,
        configuration: params.configuration ?? 'Debug',
        useLatestOS: params.useLatestOS ?? true,
      });
    },
  );
}
