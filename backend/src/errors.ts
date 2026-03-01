export class AppError extends Error {
  readonly statusCode: number
  readonly errorCode: string
  readonly details?: Record<string, unknown>

  constructor(errorCode: string, message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message)
    this.name = 'AppError'
    this.errorCode = errorCode
    this.statusCode = statusCode
    this.details = details
  }
}

export const isAppError = (value: unknown): value is AppError => value instanceof AppError
