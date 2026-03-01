import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const createNonce = (): string => randomBytes(16).toString('hex')

export const computeCommitment = (hmacKey: string, chainId: number, wallet: string, nonce: string): string =>
  createHmac('sha256', hmacKey)
    .update(`zawyafi:${chainId}:${wallet.toLowerCase()}:${nonce}`, 'utf8')
    .digest('hex')

export const sha256Hex = (input: string): string => createHash('sha256').update(input, 'utf8').digest('hex')

export const verifyHmacSha256 = (secret: string, payload: string, givenDigest: string): boolean => {
  const normalized = givenDigest.trim()
  const expectedHex = createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
  const expectedBase64 = Buffer.from(expectedHex, 'hex').toString('base64')

  const candidate = normalized.toLowerCase().startsWith('sha256=') ? normalized.slice('sha256='.length) : normalized

  const possibilities = [expectedHex, expectedBase64]
  for (const possibility of possibilities) {
    try {
      const left = Buffer.from(possibility)
      const right = Buffer.from(candidate)
      if (left.length === right.length && timingSafeEqual(left, right)) {
        return true
      }
    } catch {
      // ignore malformed candidate
    }
  }

  return false
}
