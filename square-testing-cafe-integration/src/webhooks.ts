import { createHmac, timingSafeEqual } from 'node:crypto'

export const buildSquareWebhookSignature = (
  signatureKey: string,
  notificationUrl: string,
  rawBody: string,
): string => {
  const content = `${notificationUrl}${rawBody}`
  return createHmac('sha256', signatureKey).update(content, 'utf8').digest('base64')
}

export const verifySquareWebhookSignature = (
  signatureKey: string,
  notificationUrl: string,
  rawBody: string,
  providedSignature: string,
): boolean => {
  const expected = buildSquareWebhookSignature(signatureKey, notificationUrl, rawBody)
  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(providedSignature)

  if (expectedBuffer.length !== providedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, providedBuffer)
}
