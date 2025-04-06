import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { log } from '../utils/logger.js';
import { ToolResponse } from '../types/common.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createTextContent } from './common.js';

// Constants
const DEFAULT_MAX_DEPTH = 5;

// Type definition for parameters
type DiscoverProjectsParams = {
  scanPath?: string;
  maxDepth: number;
  workspaceRoot: string;
};

// --- Private Helper Function ---

/**
 * Recursively scans directories to find Xcode projects and workspaces.
 */
async function _findProjectsRecursive(
  currentDirAbs: string,
  workspaceRootAbs: string,
  currentDepth: number,
  maxDepth: number,
  results: { projects: string[]; workspaces: string[] },
): Promise<void> {
  const relativeDirPath = path.relative(workspaceRootAbs, currentDirAbs);
  if (
    relativeDirPath.startsWith('node_modules') ||
    (relativeDirPath === '' && currentDirAbs.endsWith('/node_modules'))
  ) {
    log('debug', `Skipping node_modules dir: ${relativeDirPath || 'node_modules'}`);
    return;
  }

  if (maxDepth !== -1 && currentDepth > maxDepth) {
    return;
  }

  log('debug', `Scanning directory: ${currentDirAbs} at depth ${currentDepth}`);

  try {
    const entries = await fs.readdir(currentDirAbs, { withFileTypes: true });
    for (const entry of entries) {
      const absoluteEntryPath = path.join(currentDirAbs, entry.name);

      if (entry.isSymbolicLink()) {
        log('debug', `Skipping symbolic link: ${absoluteEntryPath}`);
        continue;
      }

      if (entry.isDirectory()) {
        if (['build', 'DerivedData', 'Pods', '.git', 'node_modules'].includes(entry.name)) {
          log('debug', `Skipping directory by name: ${entry.name} at ${absoluteEntryPath}`);
          continue;
        }

        let found = false;
        let isProject = false;

        if (entry.name.endsWith('.xcodeproj')) {
          found = true;
          isProject = true;
        } else if (entry.name.endsWith('.xcworkspace')) {
          found = true;
          isProject = false;
        }

        if (found) {
          const normalizedWorkspaceRoot = path.normalize(workspaceRootAbs);
          if (!path.normalize(absoluteEntryPath).startsWith(normalizedWorkspaceRoot)) {
            log(
              'warn',
              `Discarding found item outside workspace: ${absoluteEntryPath} (Workspace: ${workspaceRootAbs})`,
            );
            continue;
          }

          const relativePath = path.relative(workspaceRootAbs, absoluteEntryPath);
          log(
            'debug',
            `Found ${isProject ? 'project' : 'workspace'}: ${relativePath} (Absolute: ${absoluteEntryPath})`,
          );
          if (isProject) {
            results.projects.push(relativePath);
          } else {
            results.workspaces.push(relativePath);
          }
          continue;
        }

        await _findProjectsRecursive(
          absoluteEntryPath,
          workspaceRootAbs,
          currentDepth + 1,
          maxDepth,
          results,
        );
      }
    }
  } catch (error: unknown) {
    let code: string | undefined;
    let message = 'Unknown error';

    // Type guard for error properties
    if (typeof error === 'object' && error !== null) {
      if ('code' in error) {
        code = String(error.code);
      }
      if (error instanceof Error) {
        message = error.message;
      }
    }

    // Ignore errors like permission denied, log others
    if (code !== 'EPERM' && code !== 'EACCES') {
      log('warn', `Error scanning directory ${currentDirAbs}: ${message}`);
    } else {
      log('debug', `Permission denied scanning directory: ${currentDirAbs}`);
    }
  }
}

/**
 * Internal logic for discovering projects.
 * NOTE: Error handling for filesystem access is done here.
 */
async function _handleDiscoveryLogic(params: DiscoverProjectsParams): Promise<ToolResponse> {
  const { scanPath: relativeScanPath, maxDepth, workspaceRoot } = params;

  // Calculate and validate the absolute scan path
  const requestedScanPath = path.resolve(workspaceRoot, relativeScanPath || '.');
  let absoluteScanPath = requestedScanPath;
  const normalizedWorkspaceRoot = path.normalize(workspaceRoot);
  if (!path.normalize(absoluteScanPath).startsWith(normalizedWorkspaceRoot)) {
    log(
      'warn',
      `Requested scan path '${relativeScanPath}' resolved outside workspace root '${workspaceRoot}'. Defaulting scan to workspace root.`,
    );
    absoluteScanPath = normalizedWorkspaceRoot;
  }

  const results = { projects: [] as string[], workspaces: [] as string[] };

  log(
    'info',
    `Starting project discovery request: path=${absoluteScanPath}, maxDepth=${maxDepth}, workspace=${workspaceRoot}`,
  );

  try {
    // Ensure the scan path exists and is a directory
    const stats = await fs.stat(absoluteScanPath);
    if (!stats.isDirectory()) {
      const errorMsg = `Scan path is not a directory: ${absoluteScanPath}`;
      log('error', errorMsg);
      // Return ToolResponse error format
      return {
        content: [createTextContent(errorMsg)],
        isError: true,
      };
    }
  } catch (error: unknown) {
    let message = 'Unknown error accessing scan path';
    let code: string | undefined;

    // Type guards
    if (typeof error === 'object' && error !== null) {
      if ('code' in error) {
        code = String(error.code);
      }
    }
    if (error instanceof Error) {
      message = error.message;
    }

    const errorMsg = `Failed to access scan path: ${absoluteScanPath}. Error: ${message}`;
    log('error', `${errorMsg} - ${code || ''}`);
    // Return ToolResponse error format
    return {
      content: [createTextContent(errorMsg)],
      isError: true,
    };
  }

  await _findProjectsRecursive(absoluteScanPath, workspaceRoot, 0, maxDepth, results);

  log(
    'info',
    `Discovery finished. Found ${results.projects.length} projects and ${results.workspaces.length} workspaces.`,
  );

  const responseContent = [
    createTextContent(
      `Discovery finished. Found ${results.projects.length} projects and ${results.workspaces.length} workspaces.`,
    ),
  ];

  if (results.projects.length > 0) {
    responseContent.push(createTextContent(`Projects:\n - ${results.projects.join('\n - ')}`));
  }

  if (results.workspaces.length > 0) {
    responseContent.push(createTextContent(`Workspaces:\n - ${results.workspaces.join('\n - ')}`));
  }

  return {
    content: responseContent,
    projects: results.projects,
    workspaces: results.workspaces,
    isError: false,
  };
}

// --- Public Tool Definition ---

export function registerDiscoverProjectsTool(server: McpServer): void {
  log('info', 'Registering discover_projects tool');

  server.tool(
    'discover_projects',
    'Scans a directory (defaults to workspace root) to find Xcode project (.xcodeproj) and workspace (.xcworkspace) files.',
    {
      workspaceRoot: z.string().describe('The absolute path of the workspace root to scan within.'),
      scanPath: z
        .string()
        .optional()
        .describe('Optional: Path relative to workspace root to scan. Defaults to workspace root.'),
      maxDepth: z
        .number()
        .int()
        .optional()
        .default(DEFAULT_MAX_DEPTH)
        .describe(
          `Optional: Maximum directory depth to scan. Defaults to ${DEFAULT_MAX_DEPTH}. Use -1 for unlimited depth.`,
        ),
    },
    async (params) => {
      try {
        return await _handleDiscoveryLogic(params as DiscoverProjectsParams);
      } catch (error: unknown) {
        let errorMessage = 'An unexpected error occurred';
        if (error instanceof Error) {
          errorMessage = `An unexpected error occurred: ${error.message}`;
          log('error', errorMessage);
        } else {
          log('error', `Caught non-Error value: ${String(error)}`);
          errorMessage = 'An unexpected non-error value was thrown.';
        }
        return {
          content: [createTextContent(errorMessage)],
          isError: true,
        };
      }
    },
  );
}
