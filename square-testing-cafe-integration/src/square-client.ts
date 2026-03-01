import { AppError, mapSquareHttpError } from './errors'
import type { NormalizedPayment, NormalizedRefund, SquareLocation } from './types'

interface SquareClientConfig {
  baseUrl: string
  version: string
  token: string
  timeoutMs: number
  maxRetries: number
  retryBaseDelayMs: number
}

interface SquareListResponse<T> {
  items: T[]
  pageCount: number
}

interface SquareMoney {
  amount?: number | string
  currency?: string
}

interface SquarePaymentRow {
  id?: string
  order_id?: string
  amount_money?: SquareMoney
  status?: string
  created_at?: string
  note?: string
}

interface SquareRefundRow {
  id?: string
  amount_money?: SquareMoney
  status?: string
  created_at?: string
}

interface SquareLocationRow {
  id?: string
  name?: string
  status?: string
  country?: string
  timezone?: string
}

const delay = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

interface RequestJsonOptions {
  path: string
  query?: URLSearchParams
}

export class SquareClient {
  private readonly config: SquareClientConfig
  private readonly fetchFn: typeof fetch

  constructor(config: SquareClientConfig, fetchFn: typeof fetch = fetch) {
    this.config = config
    this.fetchFn = fetchFn
  }

  async listLocations(): Promise<SquareLocation[]> {
    const json = await this.requestJson({ path: '/v2/locations' })
    const rows = Array.isArray(json.locations) ? (json.locations as SquareLocationRow[]) : []

    return rows
      .filter((row) => typeof row.id === 'string' && row.id.length > 0)
      .map((row) => ({
        id: String(row.id),
        name: String(row.name ?? ''),
        status: String(row.status ?? 'UNKNOWN'),
        country: row.country,
        timezone: row.timezone,
        raw: row as unknown as Record<string, unknown>,
      }))
  }

  async listPayments(beginTime: string, endTime: string): Promise<SquareListResponse<NormalizedPayment>> {
    return this.listPaginated<NormalizedPayment>('/v2/payments', beginTime, endTime, (json: any) => {
      const rows = Array.isArray(json.payments) ? (json.payments as SquarePaymentRow[]) : []
      return rows
        .filter((row) => row.id && row.amount_money?.amount !== undefined)
        .map((row) => {
          const note = typeof row.note === 'string' ? row.note : undefined
          const inferred = inferCategoryItemFromNote(note)
          return {
            id: String(row.id),
            orderId: typeof row.order_id === 'string' ? row.order_id : undefined,
            amountMinor: parseMinorAmount(row.amount_money?.amount),
            currency: String(row.amount_money?.currency ?? 'USD'),
            status: String(row.status ?? ''),
            createdAt: String(row.created_at ?? ''),
            note,
            categoryName: inferred.categoryName,
            itemName: inferred.itemName,
            raw: row as unknown as Record<string, unknown>,
          }
        })
    })
  }

  async listRefunds(beginTime: string, endTime: string): Promise<SquareListResponse<NormalizedRefund>> {
    return this.listPaginated<NormalizedRefund>('/v2/refunds', beginTime, endTime, (json: any) => {
      const rows = Array.isArray(json.refunds) ? (json.refunds as SquareRefundRow[]) : []
      return rows
        .filter((row) => row.id && row.amount_money?.amount !== undefined)
        .map((row) => ({
          id: String(row.id),
          amountMinor: parseMinorAmount(row.amount_money?.amount),
          currency: String(row.amount_money?.currency ?? 'USD'),
          status: String(row.status ?? ''),
          createdAt: String(row.created_at ?? ''),
          raw: row as unknown as Record<string, unknown>,
        }))
    })
  }

  private async listPaginated<T>(
    path: string,
    beginTime: string,
    endTime: string,
    mapper: (json: any) => T[],
  ): Promise<SquareListResponse<T>> {
    const items: T[] = []
    let cursor: string | undefined
    let pageCount = 0

    do {
      const query = new URLSearchParams({
        begin_time: beginTime,
        end_time: endTime,
        sort_order: 'ASC',
      })

      if (cursor) {
        query.set('cursor', cursor)
      }

      const json = await this.requestJson({ path, query })
      const pageItems = mapper(json)
      items.push(...pageItems)
      cursor = typeof json.cursor === 'string' && json.cursor.length > 0 ? json.cursor : undefined
      pageCount += 1
    } while (cursor)

    return { items, pageCount }
  }

  private async requestJson(options: RequestJsonOptions): Promise<any> {
    const query = options.query ? `?${options.query.toString()}` : ''
    const url = `${this.config.baseUrl}${options.path}${query}`
    let attempt = 0

    while (true) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs)

      try {
        const response = await this.fetchFn(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.config.token}`,
            'Square-Version': this.config.version,
            Accept: 'application/json',
          },
          signal: controller.signal,
        })

        clearTimeout(timeout)

        if (!response.ok) {
          const mapped = mapSquareHttpError(response.status, options.path)
          const shouldRetry = mapped.retriable && attempt < this.config.maxRetries

          if (shouldRetry) {
            await delay(this.config.retryBaseDelayMs * 2 ** attempt)
            attempt += 1
            continue
          }

          throw mapped
        }

        return response.json()
      } catch (error) {
        clearTimeout(timeout)

        if (error instanceof AppError) {
          throw error
        }

        const isRetryExhausted = attempt >= this.config.maxRetries
        if (isRetryExhausted) {
          throw new AppError('SQUARE_UPSTREAM_ERROR', 'Square request failed after retries', 502, true, {
            path: options.path,
          })
        }

        await delay(this.config.retryBaseDelayMs * 2 ** attempt)
        attempt += 1
      }
    }
  }
}

const parseMinorAmount = (value: number | string | undefined): bigint => {
  if (value === undefined) {
    return 0n
  }

  if (typeof value === 'number') {
    return BigInt(value)
  }

  return BigInt(value)
}

const inferCategoryItemFromNote = (
  note?: string,
): {
  categoryName?: string
  itemName?: string
} => {
  if (!note) {
    return {}
  }

  const slashIndex = note.lastIndexOf('/')
  const dashIndex = note.lastIndexOf(' - ')

  if (slashIndex <= 0 || dashIndex < 0 || slashIndex <= dashIndex + 3) {
    return {}
  }

  const categoryName = note.slice(dashIndex + 3, slashIndex).trim()
  const itemName = note.slice(slashIndex + 1).trim()

  if (!categoryName || !itemName) {
    return {}
  }

  return {
    categoryName,
    itemName,
  }
}
