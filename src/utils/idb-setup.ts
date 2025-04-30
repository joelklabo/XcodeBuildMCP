/**
 * IDB Setup Utilities - Ensures idb tools are available
 *
 * This utility module provides functions to ensure that Meta's idb tools
 * (idb and idb_companion) are properly installed and available for use.
 */

import { execSync } from 'child_process';
import { log } from './logger.js';
import { createTextResponse } from './validation.js';
import { ToolResponse } from '../types/common.js';

// Constants
const LOG_PREFIX = '[IDB Setup]';
const IDB_VERSION = '1.1.7';
const MISE_BIN = 'mise';
const RUNNING_UNDER_MISE = Boolean(process.env.XCODEBUILDMCP_RUNNING_UNDER_MISE);

// Find Python executable paths
let PYTHON_BIN = 'python';
let PIP_BIN = 'pip';

// If running under mise, try to find the exact Python paths
if (RUNNING_UNDER_MISE) {
  try {
    // Try to get Python path from mise
    const pythonPath = execSync('mise where python', { encoding: 'utf8' }).trim();
    if (pythonPath) {
      PYTHON_BIN = `${pythonPath}/bin/python`;
      PIP_BIN = `${pythonPath}/bin/pip`;
      log('info', `${LOG_PREFIX} Using Python from mise: ${PYTHON_BIN}`);
    }
  } catch (error) {
    log('warning', `${LOG_PREFIX} Could not determine Python path from mise: ${error}`);
    // Try python3 as fallback
    PYTHON_BIN = 'python3';
    PIP_BIN = 'pip3';
  }
}

/**x
 * Check if a binary is available in the PATH
 * When running under mise, checks for specific binaries in their expected locations
 */
function isBinaryAvailable(binary: string): boolean {
  try {
    // Special handling for Python-related binaries when running under mise
    if (RUNNING_UNDER_MISE) {
      // Try to install mise tools
      execSync(`${MISE_BIN} install`, { encoding: 'utf8' });

      if (binary === 'python') {
        execSync(`${PYTHON_BIN} --version`, { encoding: 'utf8' });
        return true;
      } else if (binary === 'pip') {
        execSync(`${PIP_BIN} --version`, { encoding: 'utf8' });
        return true;
      } else if (binary === 'idb') {
        // For idb, we need to check if it's installed via pip in the Python environment
        try {
          execSync(`${PYTHON_BIN} -m idb.cli.main --version`, { encoding: 'utf8' });
          return true;
        } catch {
          // Try direct command as fallback
          try {
            execSync(`which ${binary}`, { encoding: 'utf8' });
            return true;
          } catch {
            return false;
          }
        }
      }
    }

    // Default check for other binaries
    execSync(`which ${binary}`, { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if both idb tools are available
 */
export function areIdbToolsAvailable(): boolean {
  return isBinaryAvailable('idb') && isBinaryAvailable('idb_companion');
}

/**
 * Install fb-idb Python package in the mise environment
 */
function installIdbUnderMise(): void {
  if (!RUNNING_UNDER_MISE) {
    log('info', `${LOG_PREFIX} Not running under mise, skipping fb-idb installation`);
    return;
  }

  log('info', `${LOG_PREFIX} Installing fb-idb Python package in mise environment...`);

  try {
    // First check if Python is available
    try {
      execSync(`${PYTHON_BIN} --version`, { encoding: 'utf8' });
    } catch (error) {
      log('warning', `${LOG_PREFIX} Python not found: ${error}`);
      log('info', `${LOG_PREFIX} Make sure Python is installed in your mise environment`);
      return;
    }

    // Upgrade pip first
    try {
      log('info', `${LOG_PREFIX} Upgrading pip...`);
      execSync(`${PYTHON_BIN} -m pip install --upgrade pip`, { encoding: 'utf8' });
    } catch (pipError) {
      log('warning', `${LOG_PREFIX} Error upgrading pip: ${pipError}`);
      // Continue anyway
    }

    // Install fb-idb
    log('info', `${LOG_PREFIX} Installing fb-idb ${IDB_VERSION}...`);
    execSync(`${PYTHON_BIN} -m pip install fb-idb==${IDB_VERSION}`, {
      encoding: 'utf8',
    });
    log('info', `${LOG_PREFIX} Successfully installed fb-idb ${IDB_VERSION}`);
  } catch (error) {
    log('warning', `${LOG_PREFIX} Error installing fb-idb: ${error}`);
  }
}

/**
 * Checks for idb tools availability and installs fb-idb if running under mise.
 * This function is called during server startup.
 *
 * @returns A promise that resolves regardless of whether idb tools are available
 */
export function setupIdb(): void {
  log('info', `${LOG_PREFIX} Checking idb availability...`);

  try {
    if (areIdbToolsAvailable()) {
      log('info', `${LOG_PREFIX} idb tools already available`);
      return;
    }

    if (RUNNING_UNDER_MISE) {
      if (!isBinaryAvailable('idb_companion')) {
        log(
          'warning',
          `${LOG_PREFIX} idb_companion not found. UI automation features will not be available.`,
        );
        log(
          'info',
          `${LOG_PREFIX} To enable UI automation, see section "Enabling UI Automation" in the README.`,
        );
        return;
      }

      installIdbUnderMise();

      if (isBinaryAvailable('idb')) {
        log('info', `${LOG_PREFIX} All idb tools are ready to use`);
      } else {
        log(
          'warning',
          `${LOG_PREFIX} fb-idb Python package could not be installed. UI automation features will not be available.`,
        );
      }
    } else {
      log(
        'info',
        `${LOG_PREFIX} idb is not available, UI automation features will not be available.`,
      );
      log(
        'info',
        `${LOG_PREFIX} To enable UI automation, see section "Enabling UI Automation" in the README.`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('warning', `${LOG_PREFIX} Error during idb setup: ${errorMessage}`);
    log(
      'info',
      `${LOG_PREFIX} Continuing server startup without idb tools. UI automation features will not be available.`,
    );
  }
}

export function createIdbNotAvailableResponse(): ToolResponse {
  return createTextResponse(
    'idb command not found. UI automation features will not be available.\n\n' +
      'See section "Enabling UI Automation" in the README.',
    true,
  );
}
