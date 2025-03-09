import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "child_process";

// Simple logging function that only logs to stderr
function log(level: string, message: string) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
}

// Create server instance
const server = new McpServer({
  name: "xcodebuildmcp",
  version: "1.0.0",
}, {
  capabilities: {
    tools: {
      listChanged: true
    },
    logging: {}
  }
});

// Log server initialization
log('info', 'Server initialized');

// Define the schema for build request parameters
const BuildRequestSchema = z.object({
  workspacePath: z.string().describe("Path to the .xcworkspace file"),
  scheme: z.string().describe("The scheme to build"),
  configuration: z.string().default("Debug").describe("Build configuration (Debug, Release, etc.)"),
  destination: z.string().optional().describe("The destination to build for (e.g., 'platform=iOS Simulator,name=iPhone 15')"),
  derivedDataPath: z.string().optional().describe("Path where build products and other derived data will go"),
  extraArgs: z.array(z.string()).optional().describe("Additional xcodebuild arguments")
});

// Define the type for build request parameters
type BuildRequestParams = z.infer<typeof BuildRequestSchema>;

// Define the type for build response
interface BuildResponse {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Executes an xcodebuild command to build an Xcode workspace
 * @param params Build request parameters
 * @returns Promise with build results
 */
async function makeBuildRequest(params: BuildRequestParams): Promise<BuildResponse> {
  // Log that we're starting a build request
  log('info', 'Starting build request');
  try {
    // Construct the xcodebuild command
    let command = [
      "xcodebuild",
      "-workspace", params.workspacePath,
      "-scheme", params.scheme,
      "-configuration", params.configuration
    ];

    log('info', `Building workspace: ${params.workspacePath}, scheme: ${params.scheme}, configuration: ${params.configuration}`);

    // Add optional parameters if provided
    if (params.destination) {
      command.push("-destination", params.destination);
    }

    if (params.derivedDataPath) {
      command.push("-derivedDataPath", params.derivedDataPath);
    }

    // Add any extra arguments
    if (params.extraArgs && params.extraArgs.length > 0) {
      command = [...command, ...params.extraArgs];
    }

    server.server.sendLoggingMessage({
      level: "info",
      data: `Executing: ${command.join(" ")}`,
    });

    return new Promise((resolve) => {
      const process = spawn('sh', ['-c', command.join(" ")], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        // Log chunks of stdout as they come in (limited to first 100 chars)
        if (chunk.trim()) {
          log('debug', `stdout chunk (${chunk.length} bytes): ${chunk.substring(0, 100)}${chunk.length > 100 ? '...' : ''}`);
        }
      });

      process.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        // Log stderr immediately as it's usually important
        if (chunk.trim()) {
          log('warning', `stderr: ${chunk.trim()}`);
        }
      });

      process.on('close', (exitCode) => {
        // Determine success based on exit code, not stderr content
        const success = exitCode === 0;

        // Log the raw stdout for debugging
        log('debug', `Raw stdout length: ${stdout.length} bytes`);
        
        // Try to parse JSON output if available
        let parsedOutput = stdout;
        try {
          if (stdout.trim().startsWith('{')) {
            log('debug', 'Attempting to parse JSON output');
            const jsonOutput = JSON.parse(stdout);
            // You could extract more structured information from the JSON here
            parsedOutput = JSON.stringify(jsonOutput, null, 2);
          }
        } catch (e) {
          // If JSON parsing fails, use the raw output
          server.server.sendLoggingMessage({
            level: "warning",
            data: `Failed to parse JSON output: ${e}`,
          });
          
          log('warning', `Failed to parse JSON output: ${e}`);
        }

        log('info', `Build process completed with exit code: ${exitCode}`);
        if (success) {
          log('info', 'Build successful');
        } else {
          log('error', `Build failed: ${stderr}`);
        }

        resolve({
          success,
          output: parsedOutput,
          error: stderr || undefined
        });
      });
    });
  } catch (error) {
    // Handle any errors
    server.server.sendLoggingMessage({
      level: "error",
      data: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      output: "",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Register build tool
server.tool(
  "build",
  "Builds the project using xcodebuild",
  {
    workspacePath: z.string().describe("The path to the .xcworkspace file"),
    scheme: z.string().describe("The scheme to build"),
    configuration: z.string().default("Debug").describe("Build configuration (Debug, Release, etc.)"),
    destination: z.string().optional().describe("The destination to build for (e.g., 'platform=iOS Simulator,name=iPhone 15')"),
    derivedDataPath: z.string().optional().describe("Path where build products and other derived data will go"),
    extraArgs: z.array(z.string()).optional().describe("Additional xcodebuild arguments")
  },
  async ({ workspacePath, scheme, configuration, destination, derivedDataPath, extraArgs }) => {

    if (workspacePath.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `Error: workspacePath is required`,
          },
        ],
      };
    }

    if (scheme.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Error: scheme is required",
          },
        ],
      };
    }

    // Set default configuration to "Debug" if not provided
    const buildConfiguration = configuration.length === 0 ? "Debug" : configuration;

    // Set default destination if not provided
    const buildDestination = destination && destination.length === 0 ? "platform=iOS Simulator,name=iPhone 16" : destination;

    // Log the build request parameters
    log('info', `Build request: workspace=${workspacePath}, scheme=${scheme}, config=${buildConfiguration}, dest=${buildDestination || 'default'}`);

    const buildResult = await makeBuildRequest({
      workspacePath,
      scheme,
      configuration: buildConfiguration,
      destination: buildDestination,
      derivedDataPath,
      extraArgs
    });

    // Log the build result status
    log('info', `Build ${buildResult.success ? 'succeeded' : 'failed'}. Output length: ${buildResult.output ? buildResult.output.length : 0} bytes`);

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

    // Log the build result for debugging
    log('info', `Build result output length: ${buildResult.output ? buildResult.output.length : 0} bytes`);

    // If output is empty, provide a default message
    const outputText = buildResult.output && buildResult.output.trim().length > 0
      ? `\n${buildResult.output}`
      : "\nBuild completed successfully with no detailed output.";

    return {
      content: [
        {
          type: "text",
          text: `Build successful:${outputText}`,
        },
      ],
    };
  }
)

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("XcodeBuildMCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});