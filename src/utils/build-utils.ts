/**
 * Build Utilities - Shared functions for build operations across platforms
 */

import { log } from './logger.js';
import { executeXcodeCommand, XcodePlatform, constructDestinationString } from './xcode.js';
import { ToolResponse } from '../types/common.js';
import { createTextResponse } from './validation.js';
import { BuildError } from './errors.js';

/**
 * Interface for shared build parameters
 */
export interface SharedBuildParams {
  workspacePath?: string;
  projectPath?: string;
  scheme: string;
  configuration: string;
  derivedDataPath?: string;
  extraArgs?: string[];
}

/**
 * Interface for platform-specific build options
 */
export interface PlatformBuildOptions {
  platform: XcodePlatform;
  simulatorName?: string;
  simulatorId?: string;
  useLatestOS?: boolean;
  logPrefix: string;
}

/**
 * Common function to execute an Xcode build command across platforms
 * @param params Common build parameters
 * @param platformOptions Platform-specific options
 * @returns Promise resolving to tool response
 */
export async function executeXcodeBuild(
  params: SharedBuildParams,
  platformOptions: PlatformBuildOptions,
): Promise<ToolResponse> {
  const warningMessages: { type: 'text'; text: string }[] = [];
  const warningRegex = /\[warning\]: (.*)/g;

  log('info', `Starting ${platformOptions.logPrefix} build for scheme ${params.scheme}`);

  try {
    const command = ['xcodebuild'];

    if (params.workspacePath) {
      command.push('-workspace', params.workspacePath);
    } else if (params.projectPath) {
      command.push('-project', params.projectPath);
    }

    command.push('-scheme', params.scheme);
    command.push('-configuration', params.configuration);

    // Construct destination string based on platform
    let destinationString: string;
    const isSimulatorPlatform = [
      XcodePlatform.iOSSimulator,
      XcodePlatform.watchOSSimulator,
      XcodePlatform.tvOSSimulator,
      XcodePlatform.visionOSSimulator,
    ].includes(platformOptions.platform);

    if (isSimulatorPlatform) {
      if (platformOptions.simulatorId) {
        destinationString = constructDestinationString(
          platformOptions.platform,
          undefined,
          platformOptions.simulatorId,
        );
      } else if (platformOptions.simulatorName) {
        destinationString = constructDestinationString(
          platformOptions.platform,
          platformOptions.simulatorName,
          undefined,
          platformOptions.useLatestOS,
        );
      } else {
        return createTextResponse(
          `For ${platformOptions.platform} platform, either simulatorId or simulatorName must be provided`,
          true,
        );
      }
    } else if (platformOptions.platform === XcodePlatform.macOS) {
      destinationString = 'platform=macOS,arch=arm64,arch=x86_64';
    } else if (platformOptions.platform === XcodePlatform.iOS) {
      destinationString = 'generic/platform=iOS';
    } else if (platformOptions.platform === XcodePlatform.watchOS) {
      destinationString = 'generic/platform=watchOS';
    } else if (platformOptions.platform === XcodePlatform.tvOS) {
      destinationString = 'generic/platform=tvOS';
    } else if (platformOptions.platform === XcodePlatform.visionOS) {
      destinationString = 'generic/platform=visionOS';
    } else {
      return createTextResponse(`Unsupported platform: ${platformOptions.platform}`, true);
    }

    command.push('-destination', destinationString);

    if (params.derivedDataPath) {
      command.push('-derivedDataPath', params.derivedDataPath);
    }

    if (params.extraArgs) {
      command.push(...params.extraArgs);
    }

    command.push('build');

    const result = await executeXcodeCommand(command, platformOptions.logPrefix);

    // Extract warnings from output
    let match;
    while ((match = warningRegex.exec(result.output)) !== null) {
      warningMessages.push({ type: 'text', text: `⚠️ Warning: ${match[1]}` });
    }

    if (!result.success) {
      log('error', `${platformOptions.logPrefix} build failed: ${result.error}`);

      // Collect error information for BuildError
      const _buildError = new BuildError(`Build failed for scheme ${params.scheme}`, result.error);

      // Create error response with warnings included
      const errorResponse = createTextResponse(
        `❌ ${platformOptions.logPrefix} build failed for scheme ${params.scheme}. Error: ${result.error}`,
        true,
      );

      if (warningMessages.length > 0 && errorResponse.content) {
        errorResponse.content.unshift(...warningMessages);
      }

      return errorResponse;
    }

    log('info', `✅ ${platformOptions.logPrefix} build succeeded.`);

    // Create additional info based on platform
    let additionalInfo = '';

    if (platformOptions.platform === XcodePlatform.macOS) {
      additionalInfo = `Next Steps:
1. Get App Path: get_macos_app_path_${params.workspacePath ? 'workspace' : 'project'}
2. Get Bundle ID: get_macos_bundle_id
3. Launch App: launch_macos_app`;
    } else if (platformOptions.platform === XcodePlatform.iOS) {
      additionalInfo = `Next Steps:
1. Get App Path: get_ios_device_app_path_${params.workspacePath ? 'workspace' : 'project'}
2. Get Bundle ID: get_ios_bundle_id`;
    } else if (isSimulatorPlatform) {
      const idOrName = platformOptions.simulatorId ? 'id' : 'name';
      additionalInfo = `Next Steps:
1. Get App Path: get_simulator_app_path_by_${idOrName}_...
2. Boot Simulator
3. Install & Launch App`;
    }

    const successResponse: ToolResponse = {
      content: [
        ...warningMessages,
        {
          type: 'text',
          text: `✅ ${platformOptions.logPrefix} build succeeded for scheme ${params.scheme}.`,
        },
        {
          type: 'text',
          text: additionalInfo,
        },
      ],
    };

    return successResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', `Error during ${platformOptions.logPrefix} build: ${errorMessage}`);
    return createTextResponse(
      `Error during ${platformOptions.logPrefix} build: ${errorMessage}`,
      true,
    );
  }
}
