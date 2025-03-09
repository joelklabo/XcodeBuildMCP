/**
 * Build Tool - Uses xcodebuild to build Xcode projects and workspaces
 */

import { z } from "zod";
import { log } from "../utils/logger.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeXcodeCommand, addXcodeParameters, XcodePlatform, constructDestinationString } from "../utils/xcode.js";
import { validateRequiredParam, validateCondition, validateAtLeastOneParam } from "../utils/validation.js";
import { execSync } from "child_process";

/**
 * Register the build tools with the MCP server
 * @param server The MCP server instance
 */
export function registerBuildTools(server: McpServer): void {
  // Register the build tool
  registerBuildTool(server);

  // Register the show build settings tool
  registerShowBuildSettingsTool(server);

  // Register the get app path tool
  registerGetAppPathTool(server);

  // Register the list schemes tool
  registerListSchemesTool(server);

  // Register the launch macOS app tool
  registerLaunchMacOSAppTool(server);

  // Register the build and run tool
  registerBuildAndRunTool(server);
}

function registerBuildTool(server: McpServer): void {
  server.tool(
    "build",
    "Builds the project using xcodebuild. Note: All parameters must be provided as an object, even if empty {}.",
    {
      workspacePath: z.string().optional().describe("Optional path to the .xcworkspace file"),
      projectPath: z.string().optional().describe("Optional path to the .xcodeproj file"),
      scheme: z.string().describe("The scheme to build"),
      configuration: z.string().default("Debug").describe("Build configuration (Debug, Release, etc.)"),
      platform: z.enum([
        XcodePlatform.macOS,
        XcodePlatform.iOS,
        XcodePlatform.iOSSimulator,
        XcodePlatform.watchOS,
        XcodePlatform.watchOSSimulator,
        XcodePlatform.tvOS,
        XcodePlatform.tvOSSimulator,
        XcodePlatform.visionOS,
        XcodePlatform.visionOSSimulator
      ]).default(XcodePlatform.iOSSimulator).describe("The target platform to build for"),
      simulatorName: z.string().optional().describe("Name of the simulator to use (e.g., 'iPhone 16')"),
      simulatorId: z.string().optional().describe("UUID of the simulator to use (obtained from listSimulators)"),
      useLatestOS: z.boolean().default(true).describe("Whether to use the latest OS version for simulators"),
      derivedDataPath: z.string().optional().describe("Path where build products and other derived data will go"),
      extraArgs: z.array(z.string()).optional().describe("Additional xcodebuild arguments")
    },
    async (params) => {
      // Validate required parameters
      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) {
        return schemeValidation.errorResponse;
      }

      // Validate parameter combinations
      let warningMessages = [];
      
      // If neither workspacePath nor projectPath is provided, add a warning to the response
      const pathValidation = validateCondition(
        !!(params.workspacePath || params.projectPath), // Convert to boolean with double negation
        'Neither workspacePath nor projectPath was provided. xcodebuild will look for a project in the current directory.'
      );
      
      if (!pathValidation.isValid) {
        warningMessages.push(pathValidation.warningResponse.content[0]);
      }
      
      // Validate simulator parameters for simulator platforms
      const isSimulatorPlatform = [
        XcodePlatform.iOSSimulator,
        XcodePlatform.watchOSSimulator,
        XcodePlatform.tvOSSimulator,
        XcodePlatform.visionOSSimulator
      ].includes(params.platform);
      
      if (isSimulatorPlatform && (!params.simulatorName && !params.simulatorId)) {
        warningMessages.push({
          type: "text",
          text: `Warning: No simulator name or ID provided for ${params.platform}. Using default simulator.`
        });
      }

      // Log that we're starting a build request
      log('info', 'Starting xcodebuild build request');

      try {
        // Construct the xcodebuild command
        let command = ["xcodebuild"];

        // Add common Xcode parameters (including platform and simulator parameters)
        addXcodeParameters(command, params, "Building");

        // Add build parameter
        command.push("build");

        // Execute the command
        const result = await executeXcodeCommand(command, "Build");

        // Handle the result
        if (!result.success) {
          // Parse the error message to provide more helpful information
          let errorMessage = result.error || "Unknown error";
          let suggestion = "";
          
          // Check for common error patterns and provide helpful suggestions
          if (errorMessage.includes("Unable to find a device matching the provided destination specifier")) {
            suggestion = "Try using a different simulator or check available simulators with the listSimulators tool.";
            
            // Extract available destinations from the error message
            const availableDestinationsMatch = errorMessage.match(/Available destinations for the .* scheme:([\s\S]*?)(?=\n\n|\n$|$)/);
            if (availableDestinationsMatch && availableDestinationsMatch[1]) {
              const availableDestinations = availableDestinationsMatch[1].trim();
              suggestion += `\n\nAvailable destinations:\n${availableDestinations}`;
            }
          }
          
          return {
            content: [
              {
                type: "text",
                text: `Build operation failed: ${errorMessage}`,
              },
              ...(suggestion ? [{
                type: "text",
                text: `Suggestion: ${suggestion}`,
              }] : []),
            ],
          };
        }

        // Extract app bundle path from build output if possible
        let appBundlePath = "";
        const appBundlePathMatch = result.output.match(/\/.*\.app/);
        if (appBundlePathMatch) {
          appBundlePath = appBundlePathMatch[0];
        }

        return {
          content: [
            {
              type: "text",
              text: `Build operation successful: ${result.output}`,
            },
            ...(appBundlePath ? [{
              type: "text",
              text: `\n\n📱 App Bundle Path: ${appBundlePath}`,
            }] : []),
            {
              type: "text",
              text: `\n\n📱 To get the app bundle path for installation or launching, use the getAppPath tool:

getAppPath({
  projectPath: ${params.projectPath ? `"${params.projectPath}"` : "undefined"},
  scheme: "${params.scheme}",
  platform: "${params.platform}"${params.simulatorId ? `,\n  simulatorId: "${params.simulatorId}"` : ""}${params.simulatorName ? `,\n  simulatorName: "${params.simulatorName}"` : ""}
})`,
            },
            ...(warningMessages.length > 0 ? [{
              type: "text",
              text: `\n\nWarnings:\n${warningMessages.map(msg => typeof msg === 'string' ? msg : msg.text).join('\n')}`,
            }] : []),
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error during build: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );
}

function registerShowBuildSettingsTool(server: McpServer): void {
  server.tool(
    "showBuildSettings",
    "Shows build settings for the project using xcodebuild. Note: All parameters must be provided as an object, even if empty {}.",
    {
      workspacePath: z.string().optional().describe("Optional path to the .xcworkspace file"),
      projectPath: z.string().optional().describe("Optional path to the .xcodeproj file"),
      scheme: z.string().describe("The scheme to show build settings for")
    },
    async (params) => {
      // Validate required parameters
      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) {
        return schemeValidation.errorResponse;
      }

      // If neither workspacePath nor projectPath is provided, add a warning to the response
      let warningMessages = [];
      const pathValidation = validateCondition(
        !!(params.workspacePath || params.projectPath), // Convert to boolean with double negation
        'Neither workspacePath nor projectPath was provided. xcodebuild will look for a project in the current directory.'
      );
      
      if (!pathValidation.isValid) {
        warningMessages.push(pathValidation.warningResponse.content[0]);
      }

      // Log that we're starting a show build settings request
      log('info', 'Starting xcodebuild show build settings request');

      try {
        // Construct the xcodebuild command
        let command = ["xcodebuild"];

        // Add common Xcode parameters
        addXcodeParameters(command, params, "Showing Build Settings");

        // Add show build settings parameter
        command.push("-showBuildSettings");

        // Execute the command
        const result = await executeXcodeCommand(command, "Show Build Settings");

        // Handle the result
        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: `Show build settings operation failed: ${result.error}`,
              },
            ],
          };
        }

        // Return success response with any warnings
        const responseContent = [
          ...warningMessages,
          {
            type: "text",
            text: `Show build settings operation successful: ${result.output}`,
          },
        ];

        return {
          content: responseContent,
        };
      } catch (error) {
        log('error', `Error during show build settings operation: ${error}`);
        return {
          content: [
            {
              type: "text",
              text: `Show build settings operation failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}

/**
 * Register the get app path tool
 * @param server The MCP server instance
 */
function registerGetAppPathTool(server: McpServer): void {
  server.tool(
    "getAppPath",
    "Gets the app bundle path from build settings. This is useful for finding the path to the built app for installation or launching. Note: All parameters must be provided as an object, even if empty {}.",
    {
      workspacePath: z.string().optional().describe("Optional path to the .xcworkspace file"),
      projectPath: z.string().optional().describe("Optional path to the .xcodeproj file"),
      scheme: z.string().describe("The scheme to get app path for"),
      configuration: z.string().default("Debug").describe("Build configuration (Debug, Release, etc.)"),
      platform: z.enum([
        XcodePlatform.macOS,
        XcodePlatform.iOS,
        XcodePlatform.iOSSimulator,
        XcodePlatform.watchOS,
        XcodePlatform.watchOSSimulator,
        XcodePlatform.tvOS,
        XcodePlatform.tvOSSimulator,
        XcodePlatform.visionOS,
        XcodePlatform.visionOSSimulator
      ]).default(XcodePlatform.iOSSimulator).describe("The target platform to get app path for"),
      simulatorName: z.string().optional().describe("Name of the simulator to use (e.g., 'iPhone 16')"),
      simulatorId: z.string().optional().describe("UUID of the simulator to use (obtained from listSimulators)"),
      useLatestOS: z.boolean().default(true).describe("Whether to use the latest OS version for simulators")
    },
    async (params) => {
      // Validate required parameters
      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) {
        return schemeValidation.errorResponse;
      }

      // If neither workspacePath nor projectPath is provided, add a warning to the response
      let warningMessages = [];
      const pathValidation = validateCondition(
        !!(params.workspacePath || params.projectPath), // Convert to boolean with double negation
        'Neither workspacePath nor projectPath was provided. xcodebuild will look for a project in the current directory.'
      );
      
      if (!pathValidation.isValid) {
        warningMessages.push(pathValidation.warningResponse.content[0]);
      }
      
      // Validate simulator parameters for simulator platforms
      const isSimulatorPlatform = [
        XcodePlatform.iOSSimulator,
        XcodePlatform.watchOSSimulator,
        XcodePlatform.tvOSSimulator,
        XcodePlatform.visionOSSimulator
      ].includes(params.platform);
      
      if (isSimulatorPlatform && (!params.simulatorName && !params.simulatorId)) {
        warningMessages.push({
          type: "text",
          text: `Warning: No simulator name or ID provided for ${params.platform}. Using default simulator.`
        });
      }

      // Log that we're starting a get app path request
      log('info', `Starting app path extraction for scheme ${params.scheme}`);

      try {
        // Construct the xcodebuild command
        let command = ["xcodebuild"];

        // Add common Xcode parameters (including platform and simulator parameters)
        addXcodeParameters(command, params, "Getting App Path");

        // Add show build settings parameter
        command.push("-showBuildSettings");

        // Execute the command
        const result = await executeXcodeCommand(command, "Get App Path");

        // Handle the result
        if (!result.success) {
          // Parse the error message to provide more helpful information
          let errorMessage = result.error || "Unknown error";
          let suggestion = "";
          
          // Check for common error patterns and provide helpful suggestions
          if (errorMessage.includes("Unable to find a device matching the provided destination specifier")) {
            suggestion = "Try using a different simulator or check available simulators with the listSimulators tool.";
            
            // Extract available destinations from the error message
            const availableDestinationsMatch = errorMessage.match(/Available destinations for the .* scheme:([\s\S]*?)(?=\n\n|\n$|$)/);
            if (availableDestinationsMatch && availableDestinationsMatch[1]) {
              const availableDestinations = availableDestinationsMatch[1].trim();
              suggestion += `\n\nAvailable destinations:\n${availableDestinations}`;
            }
          }
          
          return {
            content: [
              {
                type: "text",
                text: `Failed to get app path: ${errorMessage}`,
              },
              ...(suggestion ? [{
                type: "text",
                text: `Suggestion: ${suggestion}`,
              }] : []),
            ],
          };
        }

        // Extract app bundle path from build settings
        const productDirMatch = result.output.match(/BUILT_PRODUCTS_DIR\s*=\s*(.*?)(?:\s|$)/);
        const productNameMatch = result.output.match(/FULL_PRODUCT_NAME\s*=\s*(.*?)(?:\s|$)/);
        
        if (!productDirMatch || !productDirMatch[1] || !productNameMatch || !productNameMatch[1]) {
          return {
            content: [
              {
                type: "text",
                text: `Could not extract app path from build settings. Please ensure the scheme is correct and the project builds successfully.`,
              },
              {
                type: "text",
                text: `Tip: Make sure you've built the project first with the build tool using the same parameters.`,
              },
            ],
          };
        }

        // Combine the product directory and name to get the full path
        const appBundlePath = `${productDirMatch[1].trim()}/${productNameMatch[1].trim()}`;
        log('info', `Extracted app bundle path: ${appBundlePath}`);

        // Check if the app bundle exists
        try {
          execSync(`test -d "${appBundlePath}"`);
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Warning: Found app path in build settings, but the app bundle does not exist at ${appBundlePath}`,
              },
              {
                type: "text",
                text: `You may need to build the project first using the build tool with the same parameters.`,
              },
            ],
          };
        }

        // Determine the appropriate next steps based on platform
        let nextSteps = "";
        if (params.platform === XcodePlatform.macOS) {
          nextSteps = `Next Steps:
- Get bundle ID: getMacOSBundleId({ appPath: "${appBundlePath}" })
- Launch app: launchMacOSApp({ appPath: "${appBundlePath}" })`;
        } else if (params.platform === XcodePlatform.iOSSimulator) {
          nextSteps = `Next Steps:
- Install in simulator: installAppInSimulator({ simulatorUuid: "${params.simulatorId || "YOUR_SIMULATOR_UUID"}", appPath: "${appBundlePath}" })
- Get bundle ID: getiOSBundleId({ appPath: "${appBundlePath}" })
- Launch in simulator: launchAppInSimulator({ simulatorUuid: "${params.simulatorId || "YOUR_SIMULATOR_UUID"}", bundleId: "BUNDLE_ID_FROM_ABOVE" })`;
        } else {
          nextSteps = `Next Steps:
- Get bundle ID: getiOSBundleId({ appPath: "${appBundlePath}" })`;
        }

        // Return the app path with next steps guidance
        return {
          content: [
            {
              type: "text",
              text: `📱 App Bundle Path: ${appBundlePath}\n\n${nextSteps}`,
            },
            ...(warningMessages.length > 0 ? [{
              type: "text",
              text: `\nWarnings:\n${warningMessages.map(msg => typeof msg === 'string' ? msg : msg.text).join('\n')}`,
            }] : []),
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('error', `Error getting app path: ${errorMessage}`);
        
        return {
          content: [
            {
              type: "text",
              text: `Error getting app path: ${errorMessage}`,
            },
            {
              type: "text",
              text: `Tip: Make sure you've built the project first with the build tool using the same parameters.`,
            },
          ],
        };
      }
    }
  );
}

/**
 * Register the list schemes tool
 * @param server The MCP server instance
 */
function registerListSchemesTool(server: McpServer): void {
  server.tool(
    "listSchemes",
    "Lists all available schemes in an Xcode project or workspace. Note: All parameters must be provided as an object, even if empty {}.",
    {
      workspacePath: z.string().optional().describe("Optional path to the .xcworkspace file"),
      projectPath: z.string().optional().describe("Optional path to the .xcodeproj file")
    },
    async (params) => {
      // Validate that at least one of workspacePath or projectPath is provided
      const pathValidation = validateAtLeastOneParam('workspacePath', params.workspacePath, 'projectPath', params.projectPath);
      if (!pathValidation.isValid) {
        return pathValidation.errorResponse;
      }

      // Log that we're starting a list schemes request
      log('info', 'Starting xcodebuild list schemes request');

      try {
        // Construct the xcodebuild command
        let command = ["xcodebuild"];

        // Add project or workspace parameter
        if (params.workspacePath) {
          command.push("-workspace", params.workspacePath);
          log('info', `Using workspace: ${params.workspacePath}`);
        } else if (params.projectPath) {
          command.push("-project", params.projectPath);
          log('info', `Using project: ${params.projectPath}`);
        }

        // Add list parameter
        command.push("-list");

        // Execute the command
        const result = await executeXcodeCommand(command, "List Schemes");

        // Handle the result
        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: `List schemes operation failed: ${result.error}`,
              },
            ],
          };
        }

        // Extract schemes from the output
        const schemesMatch = result.output.match(/Schemes:\n([\s\S]*?)(?:\n\n|$)/);
        
        if (!schemesMatch || !schemesMatch[1]) {
          return {
            content: [
              {
                type: "text",
                text: `No schemes found in the project. Output: ${result.output}`,
              },
            ],
          };
        }

        // Parse the schemes
        const schemes = schemesMatch[1].trim().split('\n').map(s => s.trim());
        
        // Prepare response content with schemes and example usage
        let responseText = `Available schemes:\n\n`;
        
        schemes.forEach(scheme => {
          responseText += `- ${scheme}\n`;
        });
        
        // Add example usage if schemes were found
        if (schemes.length > 0) {
          const exampleScheme = schemes[0];
          responseText += `\nNext Steps:\n`;
          responseText += `- Build a scheme: build({\n${params.workspacePath ? `  workspacePath: "${params.workspacePath}",\n` : ''}${params.projectPath ? `  projectPath: "${params.projectPath}",\n` : ''}  scheme: "${exampleScheme}"\n})\n`;
          responseText += `- Get app path: getAppPath({\n${params.workspacePath ? `  workspacePath: "${params.workspacePath}",\n` : ''}${params.projectPath ? `  projectPath: "${params.projectPath}",\n` : ''}  scheme: "${exampleScheme}"\n})`;
        }

        return {
          content: [
            {
              type: "text",
              text: responseText,
            },
          ],
        };
      } catch (error) {
        log('error', `Error during list schemes operation: ${error}`);
        return {
          content: [
            {
              type: "text",
              text: `List schemes operation failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}

/**
 * Register the launch macOS app tool
 * @param server The MCP server instance
 */
function registerLaunchMacOSAppTool(server: McpServer): void {
  server.tool(
    "launchMacOSApp",
    "Launches a macOS app using the open command. Note: All parameters must be provided as an object, even if empty {}.",
    {
      appPath: z.string().describe("Path to the .app bundle to launch (full path to the .app directory)"),
      args: z.array(z.string()).optional().describe("Additional arguments to pass to the app")
    },
    async (params) => {
      // Validate required parameters
      const appPathValidation = validateRequiredParam('appPath', params.appPath);
      if (!appPathValidation.isValid) {
        return appPathValidation.errorResponse;
      }

      // Log that we're starting a launch macOS app request
      log('info', `Starting macOS app launch for ${params.appPath}`);

      try {
        // Construct the open command
        let command = ["open", params.appPath];
        
        // Add arguments if provided
        if (params.args && params.args.length > 0) {
          command.push("--args", ...params.args);
          log('info', `Using arguments: ${params.args.join(' ')}`);
        }

        // Execute the command
        log('info', `Executing command: ${command.join(' ')}`);
        const output = execSync(command.join(' '), { encoding: 'utf-8' });
        
        // Return success response
        return {
          content: [
            {
              type: "text",
              text: `Successfully launched macOS app: ${params.appPath}${output ? `\nOutput: ${output}` : ''}`,
            },
          ],
        };
      } catch (error) {
        log('error', `Error launching macOS app: ${error instanceof Error ? error.message : String(error)}`);
        
        return {
          content: [
            {
              type: "text",
              text: `Error launching macOS app: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}

/**
 * Register the build and run tool
 * @param server The MCP server instance
 */
function registerBuildAndRunTool(server: McpServer): void {
  server.tool(
    "buildAndRun",
    "Builds and runs an iOS or macOS app in one step. For iOS apps, it will build, install, and launch on a simulator. For macOS apps, it will build and launch. Note: All parameters must be provided as an object, even if empty {}.",
    {
      workspacePath: z.string().optional().describe("Optional path to the .xcworkspace file"),
      projectPath: z.string().optional().describe("Optional path to the .xcodeproj file"),
      scheme: z.string().describe("The scheme to build and run"),
      configuration: z.string().default("Debug").describe("Build configuration (Debug, Release, etc.)"),
      platform: z.enum([
        XcodePlatform.macOS,
        XcodePlatform.iOSSimulator
      ]).default(XcodePlatform.iOSSimulator).describe("The target platform (only macOS and iOS Simulator supported)"),
      simulatorName: z.string().optional().describe("Name of the simulator to use (e.g., 'iPhone 16')"),
      simulatorId: z.string().optional().describe("UUID of the simulator to use (obtained from listSimulators)"),
      useLatestOS: z.boolean().default(true).describe("Whether to use the latest OS version for simulators"),
      derivedDataPath: z.string().optional().describe("Path where build products and other derived data will go"),
      extraArgs: z.array(z.string()).optional().describe("Additional xcodebuild arguments")
    },
    async (params) => {
      // Validate required parameters
      const schemeValidation = validateRequiredParam('scheme', params.scheme);
      if (!schemeValidation.isValid) {
        return schemeValidation.errorResponse;
      }

      // Validate platform
      if (params.platform !== XcodePlatform.macOS && params.platform !== XcodePlatform.iOSSimulator) {
        return {
          content: [
            {
              type: "text",
              text: `Error: The buildAndRun tool only supports macOS and iOS Simulator platforms. Received: ${params.platform}`,
            },
          ],
        };
      }

      // Log that we're starting a build and run request
      log('info', `Starting build and run for scheme ${params.scheme} on platform ${params.platform}`);

      try {
        // Step 1: Build the app
        log('info', 'Step 1: Building the app');
        
        // Construct the xcodebuild command for building
        let buildCommand = ["xcodebuild"];
        
        // Add common Xcode parameters
        addXcodeParameters(buildCommand, params, "Building");
        
        // Add build parameter
        buildCommand.push("build");
        
        // Execute the build command
        const buildResult = await executeXcodeCommand(buildCommand, "Build");
        
        if (!buildResult.success) {
          return {
            content: [
              {
                type: "text",
                text: `Build failed: ${buildResult.error}`,
              },
            ],
          };
        }
        
        log('info', 'Build successful');
        
        // Step 2: Get the app path
        log('info', 'Step 2: Getting app path');
        
        // Construct the xcodebuild command for getting app path
        let appPathCommand = ["xcodebuild"];
        
        // Add common Xcode parameters
        addXcodeParameters(appPathCommand, params, "Getting App Path");
        
        // Add show build settings parameter
        appPathCommand.push("-showBuildSettings");
        
        // Execute the command
        const appPathResult = await executeXcodeCommand(appPathCommand, "Get App Path");
        
        if (!appPathResult.success) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to get app path: ${appPathResult.error}`,
              },
            ],
          };
        }
        
        // Extract app bundle path from build settings
        const productDirMatch = appPathResult.output.match(/BUILT_PRODUCTS_DIR\s*=\s*(.*?)(?:\s|$)/);
        const productNameMatch = appPathResult.output.match(/FULL_PRODUCT_NAME\s*=\s*(.*?)(?:\s|$)/);
        
        if (!productDirMatch || !productDirMatch[1] || !productNameMatch || !productNameMatch[1]) {
          return {
            content: [
              {
                type: "text",
                text: `Could not extract app path from build settings. Please ensure the scheme is correct and the project builds successfully.`,
              },
            ],
          };
        }
        
        // Combine the product directory and name to get the full path
        const appBundlePath = `${productDirMatch[1].trim()}/${productNameMatch[1].trim()}`;
        log('info', `App bundle path: ${appBundlePath}`);
        
        // Step 3: Handle platform-specific steps
        if (params.platform === XcodePlatform.macOS) {
          // For macOS, launch the app directly
          log('info', 'Step 3: Launching macOS app');
          
          try {
            // Use the open command to launch the app
            execSync(`open "${appBundlePath}"`);
            
            return {
              content: [
                {
                  type: "text",
                  text: `✅ Successfully built and launched macOS app: ${appBundlePath}`,
                },
              ],
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
              content: [
                {
                  type: "text",
                  text: `Error launching macOS app: ${errorMessage}`,
                },
              ],
            };
          }
        } else {
          // For iOS Simulator, we need to boot a simulator, install, and launch the app
          log('info', 'Step 3: Preparing iOS Simulator');
          
          // Get the simulator UUID
          let simulatorUuid = params.simulatorId;
          
          if (!simulatorUuid) {
            // If no simulator ID was provided, try to find one based on the name
            try {
              // Get list of simulators
              const simulatorsOutput = execSync('xcrun simctl list devices --json').toString();
              const simulatorsJson = JSON.parse(simulatorsOutput);
              
              // Find a simulator matching the name or use the first available one
              let foundSimulator = null;
              
              // Iterate through all runtimes and devices
              for (const runtime in simulatorsJson.devices) {
                const devices = simulatorsJson.devices[runtime];
                
                for (const device of devices) {
                  // If a simulator name was specified, look for a match
                  if (params.simulatorName) {
                    if (device.name === params.simulatorName && device.isAvailable) {
                      foundSimulator = device;
                      break;
                    }
                  } else if (device.name.includes('iPhone') && device.isAvailable) {
                    // If no name was specified, use the first available iPhone
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
                return {
                  content: [
                    {
                      type: "text",
                      text: `Could not find a suitable simulator. Please specify a simulatorId or simulatorName.`,
                    },
                  ],
                };
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              return {
                content: [
                  {
                    type: "text",
                    text: `Error finding simulator: ${errorMessage}`,
                  },
                ],
              };
            }
          }
          
          // Boot the simulator if it's not already booted
          try {
            // Check if the simulator is already booted
            const simulatorStateOutput = execSync(`xcrun simctl list devices | grep ${simulatorUuid}`).toString();
            const isBooted = simulatorStateOutput.includes('Booted');
            
            if (!isBooted) {
              log('info', 'Booting simulator');
              execSync(`xcrun simctl boot ${simulatorUuid}`);
            } else {
              log('info', 'Simulator is already booted');
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
              content: [
                {
                  type: "text",
                  text: `Error booting simulator: ${errorMessage}`,
                },
              ],
            };
          }
          
          // Step 4: Install the app on the simulator
          log('info', 'Step 4: Installing app on simulator');
          
          try {
            execSync(`xcrun simctl install ${simulatorUuid} "${appBundlePath}"`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
              content: [
                {
                  type: "text",
                  text: `Error installing app on simulator: ${errorMessage}`,
                },
              ],
            };
          }
          
          // Step 5: Get the bundle ID
          log('info', 'Step 5: Getting bundle ID');
          
          let bundleId;
          try {
            // Use the defaults command to read the bundle ID from Info.plist
            bundleId = execSync(`defaults read "${appBundlePath}/Info" CFBundleIdentifier`).toString().trim();
            log('info', `Bundle ID: ${bundleId}`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
              content: [
                {
                  type: "text",
                  text: `Error getting bundle ID: ${errorMessage}`,
                },
              ],
            };
          }
          
          // Step 6: Launch the app on the simulator
          log('info', 'Step 6: Launching app on simulator');
          
          try {
            execSync(`xcrun simctl launch ${simulatorUuid} ${bundleId}`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
              content: [
                {
                  type: "text",
                  text: `Error launching app on simulator: ${errorMessage}`,
                },
              ],
            };
          }
          
          // Step 7: Open the Simulator app
          log('info', 'Step 7: Opening Simulator app');
          
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
                type: "text",
                text: `✅ Successfully built and launched app on iOS Simulator:
- App: ${appBundlePath}
- Bundle ID: ${bundleId}
- Simulator: ${simulatorUuid}

The app should now be running in the iOS Simulator.`,
              },
            ],
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('error', `Error in buildAndRun: ${errorMessage}`);
        
        return {
          content: [
            {
              type: "text",
              text: `Error in buildAndRun: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );
}