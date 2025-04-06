#!/usr/bin/env node

/**
 * XcodeBuildMCP - Main entry point
 * This file imports and configures the MCP server and tools
 */

// Import server components
import { createServer, startServer } from './server/server.js';

// Import macOS build tools
import { registerMacOSBuildTools, registerMacOSBuildAndRunTools } from './tools/build_macos.js';

// Import iOS simulator build tools
import {
  registerIOSSimulatorBuildTools,
  registerIOSSimulatorBuildAndRunTools,
} from './tools/build_ios_simulator.js';

// Import iOS device build tools
import { registerIOSDeviceBuildTools } from './tools/build_ios_device.js';

// Import app path tools
import {
  registerGetMacOSAppPathWorkspaceTool,
  registerGetMacOSAppPathProjectTool,
  registerGetiOSDeviceAppPathWorkspaceTool,
  registerGetiOSDeviceAppPathProjectTool,
  registerGetSimulatorAppPathByNameWorkspaceTool,
  registerGetSimulatorAppPathByNameProjectTool,
  registerGetSimulatorAppPathByIdWorkspaceTool,
  registerGetSimulatorAppPathByIdProjectTool,
} from './tools/app_path.js';

// Import build settings and scheme tools
import {
  registerShowBuildSettingsWorkspaceTool,
  registerShowBuildSettingsProjectTool,
  registerListSchemesWorkspaceTool,
  registerListSchemesProjectTool,
} from './tools/build_settings.js';

// Import simulator tools
import {
  registerListSimulatorsTool,
  registerBootSimulatorTool,
  registerOpenSimulatorTool,
  registerInstallAppInSimulatorTool,
  registerLaunchAppInSimulatorTool,
} from './tools/simulator.js';

// Import bundle ID tools
import { registerGetMacOSBundleIdTool, registerGetiOSBundleIdTool } from './tools/bundleId.js';

// Import clean tool
import { registerCleanWorkspaceTool, registerCleanProjectTool } from './tools/clean.js';

// Import launch tools
import { registerLaunchMacOSAppTool } from './tools/launch.js';

// Import project/workspace discovery tool
import { registerDiscoverProjectsTool } from './tools/discover_projects.js';

// Import utilities
import { log } from './utils/logger.js';

/**
 * Main function to start the server
 */
async function main(): Promise<void> {
  try {
    // Create the server
    const server = createServer();

    // Register the project/workspace discovery tool
    registerDiscoverProjectsTool(server);

    // Register List/Discovery tools first
    registerListSchemesWorkspaceTool(server);
    registerListSchemesProjectTool(server);
    registerListSimulatorsTool(server);

    // Register Clean tools
    registerCleanWorkspaceTool(server);
    registerCleanProjectTool(server);

    // Register Build tools
    registerMacOSBuildTools(server);
    registerIOSSimulatorBuildTools(server);
    registerIOSDeviceBuildTools(server);

    // Register Build settings tools
    registerShowBuildSettingsWorkspaceTool(server);
    registerShowBuildSettingsProjectTool(server);

    // Register App path tools
    registerGetMacOSAppPathWorkspaceTool(server);
    registerGetMacOSAppPathProjectTool(server);
    registerGetiOSDeviceAppPathWorkspaceTool(server);
    registerGetiOSDeviceAppPathProjectTool(server);
    registerGetSimulatorAppPathByNameWorkspaceTool(server);
    registerGetSimulatorAppPathByNameProjectTool(server);
    registerGetSimulatorAppPathByIdWorkspaceTool(server);
    registerGetSimulatorAppPathByIdProjectTool(server);

    // Register Simulator management tools
    registerBootSimulatorTool(server);
    registerOpenSimulatorTool(server);

    // Register App installation and launch tools
    registerInstallAppInSimulatorTool(server);
    registerLaunchAppInSimulatorTool(server);

    // Register Bundle ID tools
    registerGetMacOSBundleIdTool(server);
    registerGetiOSBundleIdTool(server);

    // Register Launch tools
    registerLaunchMacOSAppTool(server);

    // Register build and run tools
    registerMacOSBuildAndRunTools(server);
    registerIOSSimulatorBuildAndRunTools(server);

    // Start the server
    await startServer(server);

    // Log successful startup
    log('info', 'XcodeBuildMCP server started successfully');
  } catch (error) {
    console.error('Fatal error in main():', error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error('Unhandled exception:', error);
  process.exit(1);
});
