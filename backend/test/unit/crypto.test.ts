import { computeCommitment, verifyHmacSha256 } from '../../src/crypto'

describe('crypto helpers', () => {
  it('computes deterministic commitment for same inputs', () => {
    const key = 'kyc-secret'
    const left = computeCommitment(key, 11155111, '0xA2Cd38C20Aa36a1D7d1569289D9B61E9b01a2cd7', 'nonce-1')
    const right = computeCommitment(key, 11155111, '0xa2cd38c20aa36a1d7d1569289d9b61e9b01a2cd7', 'nonce-1')

    expect(left).toBe(right)
    expect(left).toHaveLength(64)
  })

  it('verifies webhook digest in hex and base64 form', () => {
    const secret = 'sumsub-secret'
    const payload = JSON.stringify({ hello: 'world' })

    const crypto = require('node:crypto')
    const expectedHex = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
    const expectedBase64 = Buffer.from(expectedHex, 'hex').toString('base64')

    expect(verifyHmacSha256(secret, payload, expectedHex)).toBe(true)
    expect(verifyHmacSha256(secret, payload, expectedBase64)).toBe(true)
    expect(verifyHmacSha256(secret, payload, `sha256=${expectedHex}`)).toBe(true)
    expect(verifyHmacSha256(secret, payload, 'invalid')).toBe(false)
  })
})
