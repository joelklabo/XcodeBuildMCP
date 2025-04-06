/**
 * Custom error types for XcodeBuildMCP
 */

/**
 * Base error class for XcodeBuildMCP errors
 */
export class XcodeBuildMCPError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XcodeBuildMCPError';
    // This is necessary for proper inheritance in TypeScript
    Object.setPrototypeOf(this, XcodeBuildMCPError.prototype);
  }
}

/**
 * Error thrown when validation of parameters fails
 */
export class ValidationError extends XcodeBuildMCPError {
  constructor(
    message: string,
    public paramName?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error thrown when a build operation fails
 */
export class BuildError extends XcodeBuildMCPError {
  constructor(
    message: string,
    public buildOutput?: string,
  ) {
    super(message);
    this.name = 'BuildError';
    Object.setPrototypeOf(this, BuildError.prototype);
  }
}

/**
 * Error thrown for system-level errors (file access, permissions, etc.)
 */
export class SystemError extends XcodeBuildMCPError {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'SystemError';
    Object.setPrototypeOf(this, SystemError.prototype);
  }
}

/**
 * Error thrown for configuration issues
 */
export class ConfigurationError extends XcodeBuildMCPError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Error thrown for simulator-specific errors
 */
export class SimulatorError extends XcodeBuildMCPError {
  constructor(
    message: string,
    public simulatorName?: string,
    public simulatorId?: string,
  ) {
    super(message);
    this.name = 'SimulatorError';
    Object.setPrototypeOf(this, SimulatorError.prototype);
  }
}
