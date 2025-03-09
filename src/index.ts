/**
 * XcodeBuildMCP - Main entry point
 * This file imports and configures the MCP server and tools
 */

// Import server components
import { createServer, startServer } from "./server/server.js";

// Import tools
import { registerBuildTools } from "./tools/build.js";
import { registerCleanTool } from "./tools/clean.js";
import { registerSimulatorTools } from "./tools/simulator.js";
import { registerBundleIdTool } from "./tools/bundleId.js";

// Import utilities
import { log } from "./utils/logger.js";

/**
 * Main function to start the server
 */
async function main() {
  try {
    // Create the server
    const server = createServer();
    
    // Register tools
    registerBuildTools(server);
    registerCleanTool(server);
    registerSimulatorTools(server);
    registerBundleIdTool(server);
    
    // Start the server
    await startServer(server);
    
    // Log successful startup
    log('info', 'XcodeBuildMCP server started successfully');
  } catch (error) {
    console.error("Fatal error in main():", error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error("Unhandled exception:", error);
  process.exit(1);
});