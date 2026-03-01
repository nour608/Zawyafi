export type ErrorCode =
  | 'INVALID_INPUT'
  | 'SQUARE_AUTH_FAILED'
  | 'SQUARE_RATE_LIMITED'
  | 'SQUARE_UPSTREAM_ERROR'
  | 'INTERNAL_ERROR'

export interface NormalizedPayment {
  id: string
  orderId?: string
  amountMinor: bigint
  currency: string
  status: string
  createdAt: string
  note?: string
  categoryName?: string
  itemName?: string
  raw: Record<string, unknown>
}

export interface NormalizedRefund {
  id: string
  amountMinor: bigint
  currency: string
  status: string
  createdAt: string
  raw: Record<string, unknown>
}

export interface DateWindow {
  startIso: string
  endIso: string
  dayKey: string
}

export interface SquareLocation {
  id: string
  name: string
  status: string
  country?: string
  timezone?: string
  raw: Record<string, unknown>
}
