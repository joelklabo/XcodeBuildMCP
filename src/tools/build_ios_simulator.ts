/**
 * iOS Simulator Build Tools - Tools for building and running iOS applications in simulators
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { log } from '../utils/logger.js';
import { executeXcodeCommand, XcodePlatform, constructDestinationString } from '../utils/xcode.js';
import { validateRequiredParam, createTextResponse } from '../utils/validation.js';
import { ToolResponse } from '../types/common.js';
import {
  registerTool,
  workspacePathSchema,
  projectPathSchema,
  schemeSchema,
  configurationSchema,
  derivedDataPathSchema,
  extraArgsSchema,
  simulatorNameSchema,
  simulatorIdSchema,
  useLatestOSSchema,
} from './common.js';
import { execSync } from 'child_process';

// --- Private Helper Functions ---

/**
 * Internal logic for building iOS Simulator apps.
 */
async function _handleIOSSimulatorBuildLogic(params: {
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
  const warningMessages: { type: 'text'; text: string }[] = [];
  const warningRegex = /\[warning\]: (.*)/g;
  log('info', `Starting iOS Simulator build for scheme ${params.scheme} (internal)`);

  try {
    const command = ['xcodebuild'];

    if (params.workspacePath) {
      command.push('-workspace', params.workspacePath);
    } else if (params.projectPath) {
      command.push('-project', params.projectPath);
    } // No else needed, one path is guaranteed by callers

    command.push('-scheme', params.scheme);
    command.push('-configuration', params.configuration);

    // Construct destination string based on simulator parameters
    let destinationString: string;
    if (params.simulatorId) {
      destinationString = constructDestinationString(
        XcodePlatform.iOSSimulator,
        undefined,
        params.simulatorId,
      );
    } else if (params.simulatorName) {
      destinationString = constructDestinationString(
        XcodePlatform.iOSSimulator,
        params.simulatorName,
        undefined,
        params.useLatestOS,
      );
    } else {
      // This should never happen due to validation in the public functions
      return createTextResponse('Either simulatorId or simulatorName must be provided', true);
    }

    command.push('-destination', destinationString);

    if (params.derivedDataPath) {
      command.push('-derivedDataPath', params.derivedDataPath);
    }

    if (params.extraArgs) {
      command.push(...params.extraArgs);
    }

    command.push('build');

    const result = await executeXcodeCommand(command, 'iOS Simulator Build');

    let match;
    while ((match = warningRegex.exec(result.output)) !== null) {
      warningMessages.push({ type: 'text', text: `⚠️ Warning: ${match[1]}` });
    }

    if (!result.success) {
      log('error', `iOS simulator build failed: ${result.error}`);
      const errorResponse = createTextResponse(
        `❌ iOS simulator build failed. Error: ${result.error}`,
        true,
      );
      if (warningMessages.length > 0 && errorResponse.content) {
        errorResponse.content.unshift(...warningMessages);
      }
      return errorResponse;
    }

    log('info', '✅ iOS simulator build succeeded.');
    const target = params.simulatorId
      ? `simulator UUID ${params.simulatorId}`
      : `simulator name '${params.simulatorName}'`;

    const successResponse: ToolResponse = {
      content: [
        ...warningMessages,
        {
          type: 'text',
          text: `✅ iOS simulator build succeeded for scheme ${params.scheme} targeting ${target}.`,
        },
        {
          type: 'text',
          text: `Next Steps:\n1. Get App Path: Use get_app_path_by_${params.simulatorId ? 'id' : 'name'}_...\n2. Install App: Use install_app_in_simulator\n3. Launch App: Use launch_app_in_simulator`,
        },
      ],
    };
    return successResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', `Error during iOS Simulator build: ${errorMessage}`);
    return createTextResponse(`Error during iOS Simulator build: ${errorMessage}`, true);
  }
}

/**
 * Internal logic for building and running iOS Simulator apps.
 */
async function _handleIOSSimulatorBuildAndRunLogic(params: {
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
  log('info', `Starting iOS Simulator build and run for scheme ${params.scheme} (internal)`);

  try {
    // --- Build Step ---
    const buildResult = await _handleIOSSimulatorBuildLogic(params);

    if (buildResult.isError) {
      return buildResult; // Return the build error
    }

    // --- Get App Path Step ---
    const command = ['xcodebuild'];

    if (params.workspacePath) {
      command.push('-workspace', params.workspacePath);
    } else if (params.projectPath) {
      command.push('-project', params.projectPath);
    }

    command.push('-scheme', params.scheme);
    command.push('-configuration', params.configuration);

    // Construct destination string based on simulator parameters
    let destinationString: string;
    if (params.simulatorId) {
      destinationString = constructDestinationString(
        XcodePlatform.iOSSimulator,
        undefined,
        params.simulatorId,
      );
    } else if (params.simulatorName) {
      destinationString = constructDestinationString(
        XcodePlatform.iOSSimulator,
        params.simulatorName,
        undefined,
        params.useLatestOS,
      );
    } else {
      // This should never happen due to validation in the public functions
      return createTextResponse('Either simulatorId or simulatorName must be provided', true);
    }

    command.push('-destination', destinationString);
    command.push('-showBuildSettings');

    const result = await executeXcodeCommand(command, 'Get App Path');

    if (!result.success) {
      log('error', `Failed to get app path: ${result.error}`);
      return createTextResponse(
        `Build succeeded, but failed to get app path: ${result.error}`,
        true,
      );
    }

    // Extract CODESIGNING_FOLDER_PATH from build settings to get app path
    const appPathMatch = result.output.match(/CODESIGNING_FOLDER_PATH = (.+\.app)/);
    if (!appPathMatch || !appPathMatch[1]) {
      return createTextResponse(
        `Build succeeded, but could not find app path in build settings.`,
        true,
      );
    }

    const appBundlePath = appPathMatch[1].trim();
    log('info', `App bundle path for run: ${appBundlePath}`);

    // --- Find/Boot Simulator Step ---
    let simulatorUuid = params.simulatorId;
    if (!simulatorUuid && params.simulatorName) {
      try {
        log('info', `Finding simulator UUID for name: ${params.simulatorName}`);
        const simulatorsOutput = execSync('xcrun simctl list devices available --json').toString();
        const simulatorsJson = JSON.parse(simulatorsOutput);
        let foundSimulator = null;

        // Find the simulator in the available devices list
        for (const runtime in simulatorsJson.devices) {
          const devices = simulatorsJson.devices[runtime];
          for (const device of devices) {
            if (device.name === params.simulatorName && device.isAvailable) {
              foundSimulator = device;
              break;
            }
          }
          if (foundSimulator) break;
        }

        if (foundSimulator) {
          simulatorUuid = foundSimulator.udid;
          log('info', `Found simulator for run: ${foundSimulator.name} (${simulatorUuid})`);
        } else {
          return createTextResponse(
            `Build succeeded, but could not find an available simulator named '${params.simulatorName}'. Use list_simulators({}) to check available devices.`,
            true,
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return createTextResponse(
          `Build succeeded, but error finding simulator: ${errorMessage}`,
          true,
        );
      }
    }

    if (!simulatorUuid) {
      return createTextResponse(
        'Build succeeded, but no simulator specified and failed to find a suitable one.',
        true,
      );
    }

    // Ensure simulator is booted
    try {
      log('info', `Checking simulator state for UUID: ${simulatorUuid}`);
      const simulatorStateOutput = execSync('xcrun simctl list devices').toString();
      const simulatorLine = simulatorStateOutput
        .split('\n')
        .find((line) => line.includes(simulatorUuid));

      const isBooted = simulatorLine ? simulatorLine.includes('(Booted)') : false;

      if (!simulatorLine) {
        return createTextResponse(
          `Build succeeded, but could not find simulator with UUID: ${simulatorUuid}`,
          true,
        );
      }

      if (!isBooted) {
        log('info', `Booting simulator ${simulatorUuid}`);
        execSync(`xcrun simctl boot "${simulatorUuid}"`);
        // Wait a moment for the simulator to fully boot
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        log('info', `Simulator ${simulatorUuid} is already booted`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error checking/booting simulator: ${errorMessage}`);
      return createTextResponse(
        `Build succeeded, but error checking/booting simulator: ${errorMessage}`,
        true,
      );
    }

    // --- Open Simulator UI Step ---
    try {
      log('info', 'Opening Simulator app');
      execSync('open -a Simulator');
      // Give the Simulator app time to open
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('warning', `Warning: Could not open Simulator app: ${errorMessage}`);
      // Don't fail the whole operation for this
    }

    // --- Install App Step ---
    try {
      log('info', `Installing app at path: ${appBundlePath} to simulator: ${simulatorUuid}`);
      execSync(`xcrun simctl install "${simulatorUuid}" "${appBundlePath}"`);
      // Wait a moment for installation to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error installing app: ${errorMessage}`);
      return createTextResponse(
        `Build succeeded, but error installing app on simulator: ${errorMessage}`,
        true,
      );
    }

    // --- Get Bundle ID Step ---
    let bundleId;
    try {
      log('info', `Extracting bundle ID from app: ${appBundlePath}`);

      // Try PlistBuddy first (more reliable)
      try {
        bundleId = execSync(
          `/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "${appBundlePath}/Info.plist"`,
        )
          .toString()
          .trim();
      } catch (plistError: unknown) {
        // Fallback to defaults if PlistBuddy fails
        const errorMessage = plistError instanceof Error ? plistError.message : String(plistError);
        log('warning', `PlistBuddy failed, trying defaults: ${errorMessage}`);
        bundleId = execSync(`defaults read "${appBundlePath}/Info" CFBundleIdentifier`)
          .toString()
          .trim();
      }

      if (!bundleId) {
        throw new Error('Could not extract bundle ID from Info.plist');
      }

      log('info', `Bundle ID for run: ${bundleId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error getting bundle ID: ${errorMessage}`);
      return createTextResponse(
        `Build and install succeeded, but error getting bundle ID: ${errorMessage}`,
        true,
      );
    }

    // --- Launch App Step ---
    try {
      log('info', `Launching app with bundle ID: ${bundleId} on simulator: ${simulatorUuid}`);
      execSync(`xcrun simctl launch "${simulatorUuid}" "${bundleId}"`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `Error launching app: ${errorMessage}`);
      return createTextResponse(
        `Build and install succeeded, but error launching app on simulator: ${errorMessage}`,
        true,
      );
    }

    // --- Success ---
    log('info', '✅ iOS simulator build & run succeeded.');

    const target = params.simulatorId
      ? `simulator UUID ${params.simulatorId}`
      : `simulator name '${params.simulatorName}'`;

    return {
      content: [
        {
          type: 'text',
          text: `✅ iOS simulator build and run succeeded for scheme ${params.scheme} targeting ${target}.
          
The app (${bundleId}) is now running in the iOS Simulator. 
If you don't see the simulator window, it may be hidden behind other windows. The Simulator app should be open.`,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', `Error in iOS Simulator build and run: ${errorMessage}`);
    return createTextResponse(`Error in iOS Simulator build and run: ${errorMessage}`, true);
  }
}

// --- Public Tool Definitions ---

/**
 * Registers the iOS Simulator build by name workspace tool
 */
export function registerIOSSimulatorBuildByNameWorkspaceTool(server: McpServer): void {
  type Params = {
    workspacePath: string;
    scheme: string;
    simulatorName: string;
    configuration?: string;
    derivedDataPath?: string;
    extraArgs?: string[];
    useLatestOS?: boolean;
  };

  registerTool<Params>(
    server,
    'ios_simulator_build_by_name_workspace',
    "Builds an iOS app from a workspace for a specific simulator by name. IMPORTANT: Requires workspacePath, scheme, and simulatorName. Example: ios_simulator_build_by_name_workspace({ workspacePath: '/path/to/MyProject.xcworkspace', scheme: 'MyScheme', simulatorName: 'iPhone 16' })",
    {
      workspacePath: workspacePathSchema,
      scheme: schemeSchema,
      simulatorName: simulatorNameSchema,
      configuration: configurationSchema,
      derivedDataPath: derivedDataPathSchema,
      extraArgs: extraArgsSchema,
      useLatestOS: useLatestOSSchema,
    },
    async (params: Params) => {
      // Validate required parameters
      const workspaceValidation = validateRequiredParam('workspacePath', params.workspacePath);
      if (!workspaceValidation.isValid) return workspaceValidation.errorResponse!;

      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) return schemeValidation.errorResponse!;

      const simulatorNameValidation = validateRequiredParam('simulatorName', params.simulatorName);
      if (!simulatorNameValidation.isValid) return simulatorNameValidation.errorResponse!;

      // Provide defaults
      return _handleIOSSimulatorBuildLogic({
        ...params,
        configuration: params.configuration ?? 'Debug',
        useLatestOS: params.useLatestOS ?? true,
      });
    },
  );
}

/**
 * Registers the iOS Simulator build by name project tool
 */
export function registerIOSSimulatorBuildByNameProjectTool(server: McpServer): void {
  type Params = {
    projectPath: string;
    scheme: string;
    simulatorName: string;
    configuration?: string;
    derivedDataPath?: string;
    extraArgs?: string[];
    useLatestOS?: boolean;
  };

  registerTool<Params>(
    server,
    'ios_simulator_build_by_name_project',
    "Builds an iOS app from a project file for a specific simulator by name. IMPORTANT: Requires projectPath, scheme, and simulatorName. Example: ios_simulator_build_by_name_project({ projectPath: '/path/to/MyProject.xcodeproj', scheme: 'MyScheme', simulatorName: 'iPhone 16' })",
    {
      projectPath: projectPathSchema,
      scheme: schemeSchema,
      simulatorName: simulatorNameSchema,
      configuration: configurationSchema,
      derivedDataPath: derivedDataPathSchema,
      extraArgs: extraArgsSchema,
      useLatestOS: useLatestOSSchema,
    },
    async (params: Params) => {
      // Validate required parameters
      const projectValidation = validateRequiredParam('projectPath', params.projectPath);
      if (!projectValidation.isValid) return projectValidation.errorResponse!;

      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) return schemeValidation.errorResponse!;

      const simulatorNameValidation = validateRequiredParam('simulatorName', params.simulatorName);
      if (!simulatorNameValidation.isValid) return simulatorNameValidation.errorResponse!;

      // Provide defaults
      return _handleIOSSimulatorBuildLogic({
        ...params,
        configuration: params.configuration ?? 'Debug',
        useLatestOS: params.useLatestOS ?? true,
      });
    },
  );
}

/**
 * Registers the iOS Simulator build by ID workspace tool
 */
export function registerIOSSimulatorBuildByIdWorkspaceTool(server: McpServer): void {
  type Params = {
    workspacePath: string;
    scheme: string;
    simulatorId: string;
    configuration?: string;
    derivedDataPath?: string;
    extraArgs?: string[];
    useLatestOS?: boolean;
  };

  registerTool<Params>(
    server,
    'ios_simulator_build_by_id_workspace',
    "Builds an iOS app from a workspace for a specific simulator by UUID. IMPORTANT: Requires workspacePath, scheme, and simulatorId. Example: ios_simulator_build_by_id_workspace({ workspacePath: '/path/to/MyProject.xcworkspace', scheme: 'MyScheme', simulatorId: 'SIMULATOR_UUID' })",
    {
      workspacePath: workspacePathSchema,
      scheme: schemeSchema,
      simulatorId: simulatorIdSchema,
      configuration: configurationSchema,
      derivedDataPath: derivedDataPathSchema,
      extraArgs: extraArgsSchema,
      useLatestOS: useLatestOSSchema,
    },
    async (params: Params) => {
      // Validate required parameters
      const workspaceValidation = validateRequiredParam('workspacePath', params.workspacePath);
      if (!workspaceValidation.isValid) return workspaceValidation.errorResponse!;

      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) return schemeValidation.errorResponse!;

      const simulatorIdValidation = validateRequiredParam('simulatorId', params.simulatorId);
      if (!simulatorIdValidation.isValid) return simulatorIdValidation.errorResponse!;

      // Provide defaults
      return _handleIOSSimulatorBuildLogic({
        ...params,
        configuration: params.configuration ?? 'Debug',
        useLatestOS: params.useLatestOS ?? true, // May be ignored by xcodebuild
      });
    },
  );
}

/**
 * Registers the iOS Simulator build by ID project tool
 */
export function registerIOSSimulatorBuildByIdProjectTool(server: McpServer): void {
  type Params = {
    projectPath: string;
    scheme: string;
    simulatorId: string;
    configuration?: string;
    derivedDataPath?: string;
    extraArgs?: string[];
    useLatestOS?: boolean;
  };

  registerTool<Params>(
    server,
    'ios_simulator_build_by_id_project',
    "Builds an iOS app from a project file for a specific simulator by UUID. IMPORTANT: Requires projectPath, scheme, and simulatorId. Example: ios_simulator_build_by_id_project({ projectPath: '/path/to/MyProject.xcodeproj', scheme: 'MyScheme', simulatorId: 'SIMULATOR_UUID' })",
    {
      projectPath: projectPathSchema,
      scheme: schemeSchema,
      simulatorId: simulatorIdSchema,
      configuration: configurationSchema,
      derivedDataPath: derivedDataPathSchema,
      extraArgs: extraArgsSchema,
      useLatestOS: useLatestOSSchema,
    },
    async (params: Params) => {
      // Validate required parameters
      const projectValidation = validateRequiredParam('projectPath', params.projectPath);
      if (!projectValidation.isValid) return projectValidation.errorResponse!;

      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) return schemeValidation.errorResponse!;

      const simulatorIdValidation = validateRequiredParam('simulatorId', params.simulatorId);
      if (!simulatorIdValidation.isValid) return simulatorIdValidation.errorResponse!;

      // Provide defaults
      return _handleIOSSimulatorBuildLogic({
        ...params,
        configuration: params.configuration ?? 'Debug',
        useLatestOS: params.useLatestOS ?? true, // May be ignored by xcodebuild
      });
    },
  );
}

/**
 * Registers the iOS Simulator build and run by name workspace tool
 */
export function registerIOSSimulatorBuildAndRunByNameWorkspaceTool(server: McpServer): void {
  type Params = {
    workspacePath: string;
    scheme: string;
    simulatorName: string;
    configuration?: string;
    derivedDataPath?: string;
    extraArgs?: string[];
    useLatestOS?: boolean;
  };

  registerTool<Params>(
    server,
    'ios_simulator_build_and_run_by_name_workspace',
    "Builds and runs an iOS app from a workspace on a simulator specified by name. IMPORTANT: Requires workspacePath, scheme, and simulatorName. Example: ios_simulator_build_and_run_by_name_workspace({ workspacePath: '/path/to/workspace', scheme: 'MyScheme', simulatorName: 'iPhone 16' })",
    {
      workspacePath: workspacePathSchema,
      scheme: schemeSchema,
      simulatorName: simulatorNameSchema,
      configuration: configurationSchema,
      derivedDataPath: derivedDataPathSchema,
      extraArgs: extraArgsSchema,
      useLatestOS: useLatestOSSchema,
    },
    async (params: Params) => {
      // Validate required parameters
      const workspaceValidation = validateRequiredParam('workspacePath', params.workspacePath);
      if (!workspaceValidation.isValid) return workspaceValidation.errorResponse!;

      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) return schemeValidation.errorResponse!;

      const simulatorNameValidation = validateRequiredParam('simulatorName', params.simulatorName);
      if (!simulatorNameValidation.isValid) return simulatorNameValidation.errorResponse!;

      // Provide defaults
      return _handleIOSSimulatorBuildAndRunLogic({
        ...params,
        configuration: params.configuration ?? 'Debug',
        useLatestOS: params.useLatestOS ?? true,
      });
    },
  );
}

/**
 * Registers the iOS Simulator build and run by name project tool
 */
export function registerIOSSimulatorBuildAndRunByNameProjectTool(server: McpServer): void {
  type Params = {
    projectPath: string;
    scheme: string;
    simulatorName: string;
    configuration?: string;
    derivedDataPath?: string;
    extraArgs?: string[];
    useLatestOS?: boolean;
  };

  registerTool<Params>(
    server,
    'ios_simulator_build_and_run_by_name_project',
    "Builds and runs an iOS app from a project file on a simulator specified by name. IMPORTANT: Requires projectPath, scheme, and simulatorName. Example: ios_simulator_build_and_run_by_name_project({ projectPath: '/path/to/project.xcodeproj', scheme: 'MyScheme', simulatorName: 'iPhone 16' })",
    {
      projectPath: projectPathSchema,
      scheme: schemeSchema,
      simulatorName: simulatorNameSchema,
      configuration: configurationSchema,
      derivedDataPath: derivedDataPathSchema,
      extraArgs: extraArgsSchema,
      useLatestOS: useLatestOSSchema,
    },
    async (params: Params) => {
      // Validate required parameters
      const projectValidation = validateRequiredParam('projectPath', params.projectPath);
      if (!projectValidation.isValid) return projectValidation.errorResponse!;

      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) return schemeValidation.errorResponse!;

      const simulatorNameValidation = validateRequiredParam('simulatorName', params.simulatorName);
      if (!simulatorNameValidation.isValid) return simulatorNameValidation.errorResponse!;

      // Provide defaults
      return _handleIOSSimulatorBuildAndRunLogic({
        ...params,
        configuration: params.configuration ?? 'Debug',
        useLatestOS: params.useLatestOS ?? true,
      });
    },
  );
}

/**
 * Registers the iOS Simulator build and run by ID workspace tool
 */
export function registerIOSSimulatorBuildAndRunByIdWorkspaceTool(server: McpServer): void {
  type Params = {
    workspacePath: string;
    scheme: string;
    simulatorId: string;
    configuration?: string;
    derivedDataPath?: string;
    extraArgs?: string[];
    useLatestOS?: boolean;
  };

  registerTool<Params>(
    server,
    'ios_simulator_build_and_run_by_id_workspace',
    "Builds and runs an iOS app from a workspace on a simulator specified by UUID. IMPORTANT: Requires workspacePath, scheme, and simulatorId. Example: ios_simulator_build_and_run_by_id_workspace({ workspacePath: '/path/to/workspace', scheme: 'MyScheme', simulatorId: 'SIMULATOR_UUID' })",
    {
      workspacePath: workspacePathSchema,
      scheme: schemeSchema,
      simulatorId: simulatorIdSchema,
      configuration: configurationSchema,
      derivedDataPath: derivedDataPathSchema,
      extraArgs: extraArgsSchema,
      useLatestOS: useLatestOSSchema,
    },
    async (params: Params) => {
      // Validate required parameters
      const workspaceValidation = validateRequiredParam('workspacePath', params.workspacePath);
      if (!workspaceValidation.isValid) return workspaceValidation.errorResponse!;

      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) return schemeValidation.errorResponse!;

      const simulatorIdValidation = validateRequiredParam('simulatorId', params.simulatorId);
      if (!simulatorIdValidation.isValid) return simulatorIdValidation.errorResponse!;

      // Provide defaults
      return _handleIOSSimulatorBuildAndRunLogic({
        ...params,
        configuration: params.configuration ?? 'Debug',
        useLatestOS: params.useLatestOS ?? true, // May be ignored
      });
    },
  );
}

/**
 * Registers the iOS Simulator build and run by ID project tool
 */
export function registerIOSSimulatorBuildAndRunByIdProjectTool(server: McpServer): void {
  type Params = {
    projectPath: string;
    scheme: string;
    simulatorId: string;
    configuration?: string;
    derivedDataPath?: string;
    extraArgs?: string[];
    useLatestOS?: boolean;
  };

  registerTool<Params>(
    server,
    'ios_simulator_build_and_run_by_id_project',
    "Builds and runs an iOS app from a project file on a simulator specified by UUID. IMPORTANT: Requires projectPath, scheme, and simulatorId. Example: ios_simulator_build_and_run_by_id_project({ projectPath: '/path/to/project.xcodeproj', scheme: 'MyScheme', simulatorId: 'SIMULATOR_UUID' })",
    {
      projectPath: projectPathSchema,
      scheme: schemeSchema,
      simulatorId: simulatorIdSchema,
      configuration: configurationSchema,
      derivedDataPath: derivedDataPathSchema,
      extraArgs: extraArgsSchema,
      useLatestOS: useLatestOSSchema,
    },
    async (params: Params) => {
      // Validate required parameters
      const projectValidation = validateRequiredParam('projectPath', params.projectPath);
      if (!projectValidation.isValid) return projectValidation.errorResponse!;

      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) return schemeValidation.errorResponse!;

      const simulatorIdValidation = validateRequiredParam('simulatorId', params.simulatorId);
      if (!simulatorIdValidation.isValid) return simulatorIdValidation.errorResponse!;

      // Provide defaults
      return _handleIOSSimulatorBuildAndRunLogic({
        ...params,
        configuration: params.configuration ?? 'Debug',
        useLatestOS: params.useLatestOS ?? true, // May be ignored
      });
    },
  );
}

// Register all iOS simulator build tools
export function registerIOSSimulatorBuildTools(server: McpServer): void {
  registerIOSSimulatorBuildByNameWorkspaceTool(server);
  registerIOSSimulatorBuildByNameProjectTool(server);
  registerIOSSimulatorBuildByIdWorkspaceTool(server);
  registerIOSSimulatorBuildByIdProjectTool(server);
}

// Register all iOS simulator build and run tools
export function registerIOSSimulatorBuildAndRunTools(server: McpServer): void {
  registerIOSSimulatorBuildAndRunByNameWorkspaceTool(server);
  registerIOSSimulatorBuildAndRunByNameProjectTool(server);
  registerIOSSimulatorBuildAndRunByIdWorkspaceTool(server);
  registerIOSSimulatorBuildAndRunByIdProjectTool(server);
}
