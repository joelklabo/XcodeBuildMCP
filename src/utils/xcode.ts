/**
 * Xcode Utilities - Core infrastructure for interacting with Xcode tools
 *
 * This utility module provides the foundation for all Xcode interactions across the codebase.
 * It offers low-level command execution, platform-specific utilities, and common functionality
 * that can be used by any module requiring Xcode tool integration.
 *
 * Responsibilities:
 * - Executing xcodebuild commands with proper argument handling (executeXcodeCommand)
 * - Managing process spawning, output capture, and error handling
 * - Constructing platform-specific destination strings (constructDestinationString)
 * - Defining common parameter interfaces for Xcode operations

 *
 * This file serves as the foundation layer for more specialized utilities like build-utils.ts,
 * which build upon these core functions to provide higher-level abstractions.
 */

import { spawn } from 'child_process';
import { log } from './logger.js';
import { XcodePlatform, XcodeCommandResponse } from '../types/common.js';

// Re-export XcodePlatform for use in other modules
export { XcodePlatform };

/**
 * Execute an xcodebuild command
 * @param command Command array to execute
 * @param logPrefix Prefix for logging
 * @returns Promise resolving to command response
 */
export async function executeXcodeCommand(
  command: string[],
  logPrefix: string,
): Promise<XcodeCommandResponse> {
  // Properly escape arguments for shell
  const escapedCommand = command.map((arg) => {
    // If the argument contains spaces or special characters, wrap it in quotes
    // Ensure existing quotes are escaped
    if (/[\s,"'=]/.test(arg) && !/^".*"$/.test(arg)) {
      // Check if needs quoting and isn't already quoted
      return `"${arg.replace(/(["\\])/g, '\\$1')}"`; // Escape existing quotes and backslashes
    }
    return arg;
  });

  const commandString = escapedCommand.join(' ');
  log('info', `Executing ${logPrefix} command: ${commandString}`);
  log('debug', `DEBUG - Raw command array: ${JSON.stringify(command)}`);

  return new Promise((resolve, reject) => {
    // Using 'sh -c' to handle complex commands and quoting properly
    const process = spawn('sh', ['-c', commandString], {
      stdio: ['ignore', 'pipe', 'pipe'], // ignore stdin, pipe stdout/stderr
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      const success = code === 0;
      const response: XcodeCommandResponse = {
        success,
        output: stdout,
        error: success ? undefined : stderr,
      };

      resolve(response);
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Constructs a destination string for xcodebuild from platform and simulator parameters
 * @param platform The target platform
 * @param simulatorName Optional simulator name
 * @param simulatorId Optional simulator UUID
 * @param useLatest Whether to use the latest simulator version (primarily for named simulators)
 * @param arch Optional architecture for macOS builds (arm64 or x86_64)
 * @returns Properly formatted destination string for xcodebuild
 */
export function constructDestinationString(
  platform: XcodePlatform,
  simulatorName?: string,
  simulatorId?: string,
  useLatest: boolean = true,
  arch?: string,
): string {
  const isSimulatorPlatform = [
    XcodePlatform.iOSSimulator,
    XcodePlatform.watchOSSimulator,
    XcodePlatform.tvOSSimulator,
    XcodePlatform.visionOSSimulator,
  ].includes(platform);

  // If ID is provided for a simulator, it takes precedence and uniquely identifies it.
  if (isSimulatorPlatform && simulatorId) {
    return `platform=${platform},id=${simulatorId}`;
  }

  // If name is provided for a simulator
  if (isSimulatorPlatform && simulatorName) {
    return `platform=${platform},name=${simulatorName}${useLatest ? ',OS=latest' : ''}`;
  }

  // If it's a simulator platform but neither ID nor name is provided (should be prevented by callers now)
  if (isSimulatorPlatform && !simulatorId && !simulatorName) {
    // Throw error as specific simulator is needed unless it's a generic build action
    // Allow fallback for generic simulator builds if needed, but generally require specifics for build/run
    log(
      'warning',
      `Constructing generic destination for ${platform} without name or ID. This might not be specific enough.`,
    );
    // Example: return `platform=${platform},name=Any ${platform} Device`; // Or similar generic target
    throw new Error(`Simulator name or ID is required for specific ${platform} operations`);
  }

  // Handle non-simulator platforms
  switch (platform) {
    case XcodePlatform.macOS:
      return arch ? `platform=macOS,arch=${arch}` : 'platform=macOS';
    case XcodePlatform.iOS:
      return 'generic/platform=iOS';
    case XcodePlatform.watchOS:
      return 'generic/platform=watchOS';
    case XcodePlatform.tvOS:
      return 'generic/platform=tvOS';
    case XcodePlatform.visionOS:
      return 'generic/platform=visionOS';
    // No default needed as enum covers all cases unless extended
    // default:
    //   throw new Error(`Unsupported platform for destination string: ${platform}`);
  }
  // Fallback just in case (shouldn't be reached with enum)
  log('error', `Reached unexpected point in constructDestinationString for platform: ${platform}`);
  return `platform=${platform}`;
}
