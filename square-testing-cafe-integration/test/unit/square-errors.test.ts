import { describe, expect, it } from 'vitest'
import { mapSquareHttpError } from '../../src/errors'

describe('mapSquareHttpError', () => {
  it('maps 401 to SQUARE_AUTH_FAILED', () => {
    const error = mapSquareHttpError(401, '/v2/payments')
    expect(error.errorCode).toBe('SQUARE_AUTH_FAILED')
    expect(error.statusCode).toBe(502)
    expect(error.retriable).toBe(false)
  })

  it('maps 429 to SQUARE_RATE_LIMITED', () => {
    const error = mapSquareHttpError(429, '/v2/payments')
    expect(error.errorCode).toBe('SQUARE_RATE_LIMITED')
    expect(error.statusCode).toBe(503)
    expect(error.retriable).toBe(true)
  })

  it('maps 5xx to SQUARE_UPSTREAM_ERROR', () => {
    const error = mapSquareHttpError(503, '/v2/refunds')
    expect(error.errorCode).toBe('SQUARE_UPSTREAM_ERROR')
    expect(error.statusCode).toBe(502)
    expect(error.retriable).toBe(true)
  })
})
