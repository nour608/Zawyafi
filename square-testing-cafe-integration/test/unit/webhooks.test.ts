import { describe, expect, it } from 'vitest'
import { buildSquareWebhookSignature, verifySquareWebhookSignature } from '../../src/webhooks'

describe('Square webhook signature', () => {
  it('builds and verifies signature', () => {
    const key = 'secret-key'
    const url = 'https://api.example.com/square/webhooks'
    const body = JSON.stringify({ event_id: 'evt-1', type: 'payment.created' })

    const signature = buildSquareWebhookSignature(key, url, body)
    expect(signature).toBeTypeOf('string')
    expect(verifySquareWebhookSignature(key, url, body, signature)).toBe(true)
  })

  it('fails verification for invalid signature', () => {
    const key = 'secret-key'
    const url = 'https://api.example.com/square/webhooks'
    const body = JSON.stringify({ event_id: 'evt-1', type: 'payment.created' })

    expect(verifySquareWebhookSignature(key, url, body, 'invalid')).toBe(false)
  })
})
