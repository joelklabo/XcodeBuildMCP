/**
 * Xcode Utilities - Common functions for working with Xcode tools
 */

import { spawn } from "child_process";
import { log } from "./logger.js";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface XcodeCommandResponse {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Executes an xcodebuild command
 * @param command Array of command arguments
 * @param logPrefix Prefix for log messages
 * @returns Promise with command results
 */
export async function executeXcodeCommand(command: string[], logPrefix: string): Promise<XcodeCommandResponse> {
  log('info', `Executing ${logPrefix} command: ${command.join(' ')}`);
  
  return new Promise((resolve) => {
    const process = spawn('sh', ['-c', command.join(" ")], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      if (chunk.trim()) {
        log('debug', `stdout: ${chunk.trim()}`);
      }
    });
    
    process.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      if (chunk.trim()) {
        log('warning', `stderr: ${chunk.trim()}`);
      }
    });
    
    process.on('close', (exitCode) => {
      const success = exitCode === 0;
      
      log('info', `${logPrefix} process completed with exit code: ${exitCode}`);
      
      if (success) {
        log('info', `${logPrefix} operation successful`);
        resolve({
          success: true,
          output: stdout || `${logPrefix} operation completed successfully`
        });
      } else {
        log('error', `${logPrefix} operation failed: ${stderr}`);
        resolve({
          success: false,
          output: stdout,
          error: stderr || `Unknown error during ${logPrefix.toLowerCase()} operation`
        });
      }
    });
  });
}

/**
 * Adds common xcodebuild parameters to a command array
 * @param command Command array to modify
 * @param params Parameters to add
 * @param logPrefix Prefix for log messages
 */
export function addXcodeParameters(
  command: string[], 
  params: {
    workspacePath?: string;
    projectPath?: string;
    scheme?: string;
    configuration?: string;
    derivedDataPath?: string;
    platform?: XcodePlatform;
    simulatorName?: string;
    simulatorId?: string;
    useLatestOS?: boolean;
    extraArgs?: string[];
    [key: string]: any;
  },
  logPrefix: string
): void {
  // Add workspace or project parameter
  if (params.workspacePath) {
    command.push("-workspace", params.workspacePath);
    log('info', `${logPrefix}: Using workspace ${params.workspacePath}`);
  }
  
  if (params.projectPath) {
    command.push("-project", params.projectPath);
    log('info', `${logPrefix}: Using project ${params.projectPath}`);
  }
  
  // Add scheme parameter
  if (params.scheme) {
    command.push("-scheme", params.scheme);
    log('info', `${logPrefix}: Using scheme ${params.scheme}`);
  }
  
  // Add configuration parameter
  if (params.configuration) {
    command.push("-configuration", params.configuration);
    log('info', `${logPrefix}: Using configuration ${params.configuration}`);
  }
  
  // Add derived data path parameter
  if (params.derivedDataPath) {
    command.push("-derivedDataPath", params.derivedDataPath);
    log('info', `${logPrefix}: Using derived data path ${params.derivedDataPath}`);
  }
  
  // Add destination parameter if platform is specified
  if (params.platform) {
    try {
      // Construct destination string from platform and simulator parameters
      const destination = constructDestinationString(
        params.platform,
        params.simulatorName,
        params.simulatorId,
        params.useLatestOS ?? true
      );
      
      command.push("-destination", destination);
      log('info', `${logPrefix}: Using destination ${destination}`);
    } catch (error) {
      // Handle errors from constructDestinationString
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('error', `${logPrefix}: Error constructing destination: ${errorMessage}`);
      
      // Provide fallback for simulator platforms if possible
      if (params.platform === XcodePlatform.iOSSimulator) {
        log('info', `${logPrefix}: Falling back to generic iOS Simulator destination`);
        command.push("-destination", "platform=iOS Simulator,name=Any iOS Simulator Device");
      } else {
        // Re-throw the error if we can't provide a fallback
        throw error;
      }
    }
  }
  
  // Add any extra arguments
  if (params.extraArgs && params.extraArgs.length > 0) {
    command.push(...params.extraArgs);
    log('info', `${logPrefix}: Adding extra arguments: ${params.extraArgs.join(' ')}`);
  }
}

/**
 * Platform options for Xcode builds
 */
export enum XcodePlatform {
  macOS = "macOS",
  iOS = "iOS",
  iOSSimulator = "iOS Simulator",
  watchOS = "watchOS",
  watchOSSimulator = "watchOS Simulator",
  tvOS = "tvOS",
  tvOSSimulator = "tvOS Simulator",
  visionOS = "visionOS",
  visionOSSimulator = "visionOS Simulator"
}

/**
 * Constructs a destination string for xcodebuild from platform and simulator parameters
 * @param platform The target platform
 * @param simulatorName Optional simulator name
 * @param simulatorId Optional simulator UUID
 * @param useLatest Whether to use the latest simulator version
 * @returns Properly formatted destination string for xcodebuild
 */
export function constructDestinationString(
  platform: XcodePlatform,
  simulatorName?: string,
  simulatorId?: string,
  useLatest: boolean = true
): string {
  // Validate that we have at least one of simulatorName or simulatorId for simulator platforms
  const isSimulatorPlatform = [
    XcodePlatform.iOSSimulator,
    XcodePlatform.watchOSSimulator,
    XcodePlatform.tvOSSimulator,
    XcodePlatform.visionOSSimulator
  ].includes(platform);

  if (isSimulatorPlatform && (!simulatorName && !simulatorId)) {
    throw new Error(`Simulator name or ID is required for ${platform} platform`);
  }

  // Handle each platform type
  switch (platform) {
    case XcodePlatform.macOS:
      return "platform=macOS";
    
    case XcodePlatform.iOS:
      return "platform=iOS";
    
    case XcodePlatform.iOSSimulator:
      // For iOS Simulator, prioritize simulatorId if provided
      if (simulatorId) {
        return `platform=iOS Simulator,id=${simulatorId}`;
      } else if (simulatorName) {
        return `platform=iOS Simulator,name=${simulatorName}${useLatest ? ',OS=latest' : ''}`;
      } else {
        // Default to a common simulator if none specified
        return "platform=iOS Simulator,name=iPhone 16,OS=latest";
      }
    
    case XcodePlatform.watchOS:
      return "platform=watchOS";
    
    case XcodePlatform.watchOSSimulator:
      if (simulatorId) {
        return `platform=watchOS Simulator,id=${simulatorId}`;
      } else if (simulatorName) {
        return `platform=watchOS Simulator,name=${simulatorName}${useLatest ? ',OS=latest' : ''}`;
      } else {
        // Default to a common simulator if none specified
        return "platform=watchOS Simulator,name=Apple Watch Series 9 (45mm),OS=latest";
      }
    
    case XcodePlatform.tvOS:
      return "platform=tvOS";
    
    case XcodePlatform.tvOSSimulator:
      if (simulatorId) {
        return `platform=tvOS Simulator,id=${simulatorId}`;
      } else if (simulatorName) {
        return `platform=tvOS Simulator,name=${simulatorName}${useLatest ? ',OS=latest' : ''}`;
      } else {
        // Default to a common simulator if none specified
        return "platform=tvOS Simulator,name=Apple TV,OS=latest";
      }
    
    case XcodePlatform.visionOS:
      return "platform=visionOS";
    
    case XcodePlatform.visionOSSimulator:
      if (simulatorId) {
        return `platform=visionOS Simulator,id=${simulatorId}`;
      } else if (simulatorName) {
        return `platform=visionOS Simulator,name=${simulatorName}${useLatest ? ',OS=latest' : ''}`;
      } else {
        // Default to a common simulator if none specified
        return "platform=visionOS Simulator,name=Apple Vision Pro,OS=latest";
      }
    
    default:
      return "platform=iOS Simulator,name=iPhone 16,OS=latest";
  }
}

/**
 * Generic interface for tool response
 */
export interface ToolResponse {
  success: boolean;
  output: string;
  error?: string;
}
