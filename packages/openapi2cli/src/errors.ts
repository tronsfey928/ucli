/**
 * Typed error hierarchy for openapi2cli.
 *
 * All library code throws one of these instead of calling process.exit().
 * The top-level CLI entry point is the only place that maps errors to
 * exit codes and user-facing messages.
 */

/** Base error for the openapi2cli tool. */
export class OpenAPI2CLIError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'OpenAPI2CLIError';
  }
}

/** Failure while parsing or validating an OpenAPI spec. */
export class SpecParseError extends OpenAPI2CLIError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'SpecParseError';
  }
}

/** Invalid user input (bad JSON, missing required value, etc.). */
export class InputValidationError extends OpenAPI2CLIError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'InputValidationError';
  }
}

/** HTTP / network error from the runtime client. */
export class HttpClientError extends OpenAPI2CLIError {
  public readonly statusCode?: number;
  public readonly statusText?: string;
  public readonly responseData?: unknown;
  public readonly errorCode?: string;

  constructor(
    message: string,
    opts: {
      statusCode?: number;
      statusText?: string;
      responseData?: unknown;
      errorCode?: string;
      cause?: unknown;
    } = {},
  ) {
    super(message, opts.cause);
    this.name = 'HttpClientError';
    this.statusCode = opts.statusCode;
    this.statusText = opts.statusText;
    this.responseData = opts.responseData;
    this.errorCode = opts.errorCode;
  }
}

/** Failure during project file generation. */
export class GenerationError extends OpenAPI2CLIError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'GenerationError';
  }
}

/** Output formatting failure (e.g. invalid JMESPath expression). */
export class OutputFormatError extends OpenAPI2CLIError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'OutputFormatError';
  }
}
