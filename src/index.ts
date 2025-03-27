/**
 * XcodeBuildMCP - Main entry point
 * This file imports and configures the MCP server and tools
 */

// Import server components
import { createServer, startServer } from './server/server.js';

// Import individual tools instead of tool groups
// Build tools
import {
  registerMacOSBuildTool,
  registerIOSSimulatorBuildByNameTool,
  registerIOSSimulatorBuildByIdTool,
  registerIOSDeviceBuildTool,
  registerMacOSBuildAndRunTool,
  registerIOSSimulatorBuildAndRunByNameTool,
  registerIOSSimulatorBuildAndRunByIdTool,
  registerShowBuildSettingsTool,
  registerGetAppPathByNameTool,
  registerGetAppPathByIdTool,
  registerGetAppPathForDeviceTool,
  registerListSchemesTool,
} from './tools/build.js';

// Simulator tools
import {
  registerListSimulatorsTool,
  registerBootSimulatorTool,
  registerOpenSimulatorTool,
  registerInstallAppInSimulatorTool,
  registerLaunchAppInSimulatorTool,
} from './tools/simulator.js';

// Bundle ID tools
import { registerGetMacOSBundleIdTool, registerGetiOSBundleIdTool } from './tools/bundleId.js';

// Clean tool
import { registerCleanTool } from './tools/clean.js';

// Import utilities
import { log } from './utils/logger.js';

/**
 * Main function to start the server
 */
async function main(): Promise<void> {
  try {
    // Create the server
    const server = createServer();

    // Register tools in a logical order

    // 1. List/Discovery tools first
    registerListSchemesTool(server);
    registerListSimulatorsTool(server);

    // 2. Clean tool
    registerCleanTool(server);

    // 3. Build tools
    registerMacOSBuildTool(server);
    registerIOSSimulatorBuildByNameTool(server);
    registerIOSSimulatorBuildByIdTool(server);
    registerIOSDeviceBuildTool(server);

    // 4. Build settings tool
    registerShowBuildSettingsTool(server);

    // 5. App path tools (after build)
    registerGetAppPathByNameTool(server);
    registerGetAppPathByIdTool(server);
    registerGetAppPathForDeviceTool(server);

    // 6. Simulator control tools
    registerBootSimulatorTool(server);
    registerOpenSimulatorTool(server);

    // 7. App installation and launch tools
    registerInstallAppInSimulatorTool(server);
    registerLaunchAppInSimulatorTool(server);

    // 8. Bundle ID tools
    registerGetMacOSBundleIdTool(server);
    registerGetiOSBundleIdTool(server);

    // 9. Build and run tools (combines multiple steps)
    registerMacOSBuildAndRunTool(server);
    registerIOSSimulatorBuildAndRunByNameTool(server);
    registerIOSSimulatorBuildAndRunByIdTool(server);

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
