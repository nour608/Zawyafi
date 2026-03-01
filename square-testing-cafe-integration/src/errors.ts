import type { ErrorCode } from './types'

export class AppError extends Error {
  public readonly errorCode: ErrorCode
  public readonly statusCode: number
  public readonly retriable: boolean
  public readonly details?: Record<string, unknown>

  constructor(
    errorCode: ErrorCode,
    message: string,
    statusCode: number,
    retriable: boolean,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AppError'
    this.errorCode = errorCode
    this.statusCode = statusCode
    this.retriable = retriable
    this.details = details
  }
}

export const isAppError = (value: unknown): value is AppError => value instanceof AppError

export const toAppError = (value: unknown): AppError => {
  if (isAppError(value)) {
    return value
  }

  if (value instanceof Error) {
    return new AppError('INTERNAL_ERROR', value.message, 500, false)
  }

  return new AppError('INTERNAL_ERROR', 'Unexpected error', 500, false)
}

export const mapSquareHttpError = (status: number, path: string): AppError => {
  if (status === 401) {
    return new AppError('SQUARE_AUTH_FAILED', 'Square authentication failed', 502, false, {
      status,
      path,
    })
  }

  if (status === 429) {
    return new AppError('SQUARE_RATE_LIMITED', 'Square API rate limit exceeded', 503, true, {
      status,
      path,
    })
  }

  if (status >= 500) {
    return new AppError('SQUARE_UPSTREAM_ERROR', 'Square upstream server error', 502, true, {
      status,
      path,
    })
  }

  return new AppError('SQUARE_UPSTREAM_ERROR', `Square request failed with status ${status}`, 502, false, {
    status,
    path,
  })
}
