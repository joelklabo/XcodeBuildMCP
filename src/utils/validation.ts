/**
 * Validation Utilities - Functions for validating tool parameters
 */

import { log } from "./logger.js";
import * as fs from "fs";

/**
 * Validates that a required parameter is present
 * @param paramName Name of the parameter
 * @param paramValue Value of the parameter
 * @returns Object with validation result and error response if invalid
 */
export function validateRequiredParam(paramName: string, paramValue: any): { isValid: boolean; errorResponse?: any } {
  if (paramValue === undefined || paramValue === null) {
    log('warning', `Required parameter '${paramName}' is missing`);
    
    // Create a more helpful error message based on the parameter name
    let helpfulMessage = `Error: ${paramName} is required. For tools with no parameters, an empty object {} must still be provided.`;
    
    // Add parameter-specific guidance
    if (paramName === 'simulatorUuid') {
      helpfulMessage += `\n\nTo get a simulator UUID, first use the 'listSimulators' tool:\n  listSimulators({})`;
    } else if (paramName === 'bundleId') {
      helpfulMessage += `\n\nTo get the bundle ID for an app, you can use the 'getBundleId' tool:
   getBundleId({ projectPath: "/path/to/YourProject.xcodeproj", scheme: "YourScheme" })`;
    } else if (paramName === 'appPath') {
      helpfulMessage += `\n\nThe app path is typically found in the DerivedData directory after building:
~/Library/Developer/Xcode/DerivedData/[ProjectName]/Build/Products/Debug-iphonesimulator/[AppName].app`;
    } else if (paramName === 'scheme') {
      helpfulMessage += `\n\nThe scheme name is typically the name of your app or a specific test target.`;
    } else if (paramName === 'projectPath' || paramName === 'workspacePath') {
      helpfulMessage += `\n\nThis should be the full path to your .xcodeproj or .xcworkspace file.`;
    } else if (paramName === 'configuration') {
      helpfulMessage += `\n\nCommon configurations are 'Debug' and 'Release'. Check your project settings for available configurations.`;
    } else if (paramName === 'destination') {
      helpfulMessage += `\n\nExample destinations:
- For iOS Simulator: 'platform=iOS Simulator,name=iPhone 16,OS=latest'
- For macOS: 'platform=macOS'`;
    } else if (paramName === 'derivedDataPath') {
      helpfulMessage += `\n\nThis is typically a path like '~/Library/Developer/Xcode/DerivedData' or a custom path where build products will be stored.`;
    }
    
    return {
      isValid: false,
      errorResponse: {
        content: [
          {
            type: "text",
            text: helpfulMessage,
          },
        ],
      },
    };
  }
  return { isValid: true };
}

/**
 * Validates that a parameter value is one of the allowed values
 * @param paramName Name of the parameter
 * @param paramValue Value of the parameter
 * @param allowedValues Array of allowed values
 * @returns Object with validation result and error response if invalid
 */
export function validateAllowedValues<T>(paramName: string, paramValue: T, allowedValues: T[]): { isValid: boolean; errorResponse?: any } {
  if (!allowedValues.includes(paramValue)) {
    log('warning', `Invalid value for parameter '${paramName}': ${paramValue}. Allowed values: ${allowedValues.join(', ')}`);
    return {
      isValid: false,
      errorResponse: {
        content: [
          {
            type: "text",
            text: `Error: Invalid value for ${paramName}: ${paramValue}. Allowed values: ${allowedValues.join(', ')}`,
          },
        ],
      },
    };
  }
  return { isValid: true };
}

/**
 * Validates a condition and returns a warning message if the condition is false
 * @param condition Condition to validate (should be true to pass validation)
 * @param message Warning message to display if condition is false
 * @param logWarning Whether to log a warning message (default: true)
 * @returns Object with validation result and warning response if condition is false
 */
export function validateCondition(condition: boolean, message: string, logWarning: boolean = true): { isValid: boolean; warningResponse?: any } {
  if (!condition) {
    if (logWarning) {
      log('warning', message);
    }
    return {
      isValid: false,
      warningResponse: {
        content: [
          {
            type: "text",
            text: `Warning: ${message}`,
          },
        ],
      },
    };
  }
  return { isValid: true };
}

/**
 * Validates that a file exists at the given path
 * @param filePath Path to check
 * @returns Object with validation result and error response if invalid
 */
export function validateFileExists(filePath: string): { isValid: boolean; errorResponse?: any } {
  if (!fs.existsSync(filePath)) {
    return {
      isValid: false,
      errorResponse: {
        content: [
          {
            type: "text",
            text: `Error: File or directory does not exist at path: ${filePath}\n\nPlease check that the path is correct and accessible.`,
          },
        ],
      },
    };
  }
  return { isValid: true };
}

/**
 * Validates that at least one of two parameters is provided
 * @param param1Name Name of the first parameter
 * @param param1Value Value of the first parameter
 * @param param2Name Name of the second parameter
 * @param param2Value Value of the second parameter
 * @returns Object with validation result and error response if invalid
 */
export function validateAtLeastOneParam(
  param1Name: string, 
  param1Value: any, 
  param2Name: string, 
  param2Value: any
): { isValid: boolean; errorResponse?: any } {
  if ((param1Value === undefined || param1Value === null) && 
      (param2Value === undefined || param2Value === null)) {
    log('warning', `At least one of '${param1Name}' or '${param2Name}' is required`);
    
    return {
      isValid: false,
      errorResponse: {
        content: [
          {
            type: "text",
            text: `Error: At least one of '${param1Name}' or '${param2Name}' is required. Please provide either ${param1Name} or ${param2Name} (or both).`,
          },
        ],
      },
    };
  }
  return { isValid: true };
}
