/**
 * Validation Utilities - Input validation and error response generation
 *
 * This utility module provides a comprehensive set of validation functions to ensure
 * that tool inputs meet expected requirements. It centralizes validation logic,
 * error message formatting, and response generation for consistent error handling
 * across the application.
 *
 * Responsibilities:
 * - Validating required parameters (validateRequiredParam)
 * - Checking parameters against allowed values (validateAllowedValues, validateEnumParam)
 * - Verifying file existence (validateFileExists)
 * - Validating logical conditions (validateCondition)
 * - Ensuring at least one of multiple parameters is provided (validateAtLeastOneParam)
 * - Creating standardized response objects for tools (createTextResponse)
 *
 * Using these validation utilities ensures consistent error messaging and helps
 * provide clear feedback to users when their inputs don't meet requirements.
 * The functions return ValidationResult objects that make it easy to chain
 * validations and generate appropriate responses.
 */

import * as fs from 'fs';
import { log } from './logger.js';
import { ToolResponse, ValidationResult } from '../types/common.js';

/**
 * Creates a text response with the given message
 * @param message The message to include in the response
 * @param isError Whether this is an error response
 * @returns A ToolResponse object with the message
 */
export function createTextResponse(message: string, isError = false): ToolResponse {
  return {
    content: [
      {
        type: 'text',
        text: message,
      },
    ],
    isError,
  };
}

/**
 * Validates that a required parameter is present
 * @param paramName Name of the parameter
 * @param paramValue Value of the parameter
 * @param helpfulMessage Optional helpful message to include in the error response
 * @returns Validation result
 */
export function validateRequiredParam(
  paramName: string,
  paramValue: unknown,
  helpfulMessage = `Required parameter '${paramName}' is missing. Please provide a value for this parameter.`,
): ValidationResult {
  if (paramValue === undefined || paramValue === null) {
    log('warning', `Required parameter '${paramName}' is missing`);
    return {
      isValid: false,
      errorResponse: createTextResponse(helpfulMessage, true),
    };
  }

  return { isValid: true };
}

/**
 * Validates that a parameter value is one of the allowed values
 * @param paramName Name of the parameter
 * @param paramValue Value of the parameter
 * @param allowedValues Array of allowed values
 * @returns Validation result
 */
export function validateAllowedValues<T>(
  paramName: string,
  paramValue: T,
  allowedValues: T[],
): ValidationResult {
  if (!allowedValues.includes(paramValue)) {
    log(
      'warning',
      `Parameter '${paramName}' has invalid value '${paramValue}'. Allowed values: ${allowedValues.join(
        ', ',
      )}`,
    );
    return {
      isValid: false,
      errorResponse: createTextResponse(
        `Parameter '${paramName}' must be one of: ${allowedValues.join(', ')}. You provided: '${paramValue}'.`,
        true,
      ),
    };
  }

  return { isValid: true };
}

/**
 * Validates that a condition is true
 * @param condition Condition to validate
 * @param message Message to include in the warning response
 * @param logWarning Whether to log a warning message
 * @returns Validation result
 */
export function validateCondition(
  condition: boolean,
  message: string,
  logWarning: boolean = true,
): ValidationResult {
  if (!condition) {
    if (logWarning) {
      log('warning', message);
    }
    return {
      isValid: false,
      warningResponse: createTextResponse(message),
    };
  }

  return { isValid: true };
}

/**
 * Validates that a file exists
 * @param filePath Path to check
 * @returns Validation result
 */
export function validateFileExists(filePath: string): ValidationResult {
  if (!fs.existsSync(filePath)) {
    return {
      isValid: false,
      errorResponse: createTextResponse(
        `File not found: '${filePath}'. Please check the path and try again.`,
        true,
      ),
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
 * @returns Validation result
 */
export function validateAtLeastOneParam(
  param1Name: string,
  param1Value: unknown,
  param2Name: string,
  param2Value: unknown,
): ValidationResult {
  if (
    (param1Value === undefined || param1Value === null) &&
    (param2Value === undefined || param2Value === null)
  ) {
    log('warning', `At least one of '${param1Name}' or '${param2Name}' must be provided`);
    return {
      isValid: false,
      errorResponse: createTextResponse(
        `At least one of '${param1Name}' or '${param2Name}' must be provided.`,
        true,
      ),
    };
  }

  return { isValid: true };
}

/**
 * Validates that a parameter value is one of the allowed enum values
 * @param paramName Name of the parameter
 * @param paramValue Value of the parameter
 * @param allowedValues Array of allowed enum values
 * @returns Validation result
 */
export function validateEnumParam<T>(
  paramName: string,
  paramValue: T,
  allowedValues: T[],
): ValidationResult {
  if (!allowedValues.includes(paramValue)) {
    log(
      'warning',
      `Parameter '${paramName}' has invalid value '${paramValue}'. Allowed values: ${allowedValues.join(
        ', ',
      )}`,
    );
    return {
      isValid: false,
      errorResponse: createTextResponse(
        `Parameter '${paramName}' must be one of: ${allowedValues.join(', ')}. You provided: '${paramValue}'.`,
        true,
      ),
    };
  }

  return { isValid: true };
}

/**
 * Validates the output path for the screenshot tool
 * @param outputPath Path where the screenshot will be saved
 * @returns Validation result
 */
export function validateScreenshotOutputPath(outputPath: string): ValidationResult {
  if (!outputPath.endsWith('.png')) {
    return {
      isValid: false,
      errorResponse: createTextResponse(
        `Invalid output path: '${outputPath}'. The screenshot output path must end with '.png'.`,
        true,
      ),
    };
  }

  return { isValid: true };
}

// Export the ToolResponse type for use in other files
export { ToolResponse, ValidationResult };
