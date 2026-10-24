export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ModelProviderError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "MODEL_PROVIDER_ERROR", 502, details);
  }
}

export class ToolExecutionError extends AppError {
  constructor(toolName: string, message: string, details?: unknown) {
    super(`Tool '${toolName}' failed: ${message}`, "TOOL_EXECUTION_ERROR", 500, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}
