import { randomUUID } from 'node:crypto'
import {
  ensureCafeCatalog,
  loadCafeInventory,
  loadDotEnv,
  mustGetEnv,
  requestJson,
} from './lib/square-catalog.mjs'

loadDotEnv()

const getNumberEnv = (name, fallback) => {
  const value = process.env[name]
  if (!value) return fallback
  const parsed = Number(value)
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric env var ${name}: ${value}`)
  }

  return parsed
}

const wait = async (ms) => {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

const selectLocationId = async (params) => {
  if (params.explicitLocationId) {
    return {
      locationId: params.explicitLocationId,
      currency: (process.env.SEED_CURRENCY ?? 'USD').toUpperCase(),
    }
  }

  const payload = await requestJson({
    method: 'GET',
    path: '/v2/locations',
    token: params.token,
    baseUrl: params.baseUrl,
    version: params.version,
  })

  const activeLocation = (payload.locations ?? []).find((item) => item.status === 'ACTIVE')
  const fallbackLocation = (payload.locations ?? [])[0]
  const selected = activeLocation ?? fallbackLocation

  if (!selected?.id) {
    throw new Error('No Square locations found. Ensure your sandbox account has at least one location.')
  }

  const country = selected.country?.toUpperCase() ?? 'US'
  const currency = country === 'JP' ? 'JPY' : 'USD'

  return {
    locationId: selected.id,
    currency,
  }
}

const randomInt = (min, max) => {
  if (max < min) {
    throw new Error(`Invalid random range: min=${min}, max=${max}`)
  }

  return Math.floor(Math.random() * (max - min + 1)) + min
}

const pickRandomCatalogItem = (items) => {
  return items[randomInt(0, items.length - 1)]
}

const main = async () => {
  const token = mustGetEnv('SQUARE_PAT_FALLBACK_TOKEN')
  const baseUrl = process.env.SQUARE_BASE_URL ?? 'https://connect.squareupsandbox.com'
  const version = process.env.SQUARE_VERSION ?? '2026-01-22'

  const orderCount = getNumberEnv('SEED_ORDER_COUNT', 8)
  const requestedRefundCount = getNumberEnv('SEED_REFUND_COUNT', 1)
  const maxRefundOrderRatePercent = getNumberEnv('SEED_MAX_REFUND_ORDER_RATE_PERCENT', 20)
  const minQty = getNumberEnv('SEED_MIN_QTY', 1)
  const maxQty = getNumberEnv('SEED_MAX_QTY', 3)
  const refundMinPercent = getNumberEnv('SEED_REFUND_MIN_PERCENT', 1)
  const refundMaxPercent = getNumberEnv('SEED_REFUND_MAX_PERCENT', 4)
  const sleepMs = getNumberEnv('SEED_DELAY_MS', 150)

  if (orderCount <= 0) {
    throw new Error('SEED_ORDER_COUNT must be > 0')
  }

  if (requestedRefundCount < 0) {
    throw new Error('SEED_REFUND_COUNT must be >= 0')
  }

  if (maxRefundOrderRatePercent < 0 || maxRefundOrderRatePercent > 100) {
    throw new Error('SEED_MAX_REFUND_ORDER_RATE_PERCENT must be between 0 and 100')
  }

  if (minQty <= 0 || maxQty <= 0 || maxQty < minQty) {
    throw new Error('SEED_MIN_QTY and SEED_MAX_QTY must be positive and MAX >= MIN')
  }

  if (refundMinPercent < 0 || refundMaxPercent < 0 || refundMaxPercent < refundMinPercent) {
    throw new Error('SEED_REFUND_MIN_PERCENT and SEED_REFUND_MAX_PERCENT must be >= 0 and MAX >= MIN')
  }

  if (refundMaxPercent >= 5) {
    throw new Error('Refund percentage must be less than 5%. Set SEED_REFUND_MAX_PERCENT to 4 or lower.')
  }

  const maxRefundCountByRate = Math.max(0, Math.floor((orderCount * maxRefundOrderRatePercent) / 100))
  const refundCount = Math.min(requestedRefundCount, maxRefundCountByRate)
  const notePrefix = process.env.SEED_NOTE_PREFIX ?? 'Cafe Seed'
  const merchantLabel = process.env.SEED_MERCHANT_LABEL ?? 'cafe-sandbox'
  const explicitLocationId = process.env.SEED_LOCATION_ID

  const inventory = loadCafeInventory()
  const { locationId, currency } = await selectLocationId({
    token,
    baseUrl,
    version,
    explicitLocationId,
  })

  console.log(`Using location: ${locationId}, currency: ${currency}`)
  const catalog = await ensureCafeCatalog({
    token,
    baseUrl,
    version,
    inventory,
    currency,
    logger: console,
  })

  if (requestedRefundCount > refundCount) {
    console.log(
      `Requested refunds (${requestedRefundCount}) capped to ${refundCount} by SEED_MAX_REFUND_ORDER_RATE_PERCENT=${maxRefundOrderRatePercent}%`,
    )
  }

  const createdPayments = []
  const createdRefunds = []

  for (let i = 0; i < orderCount; i += 1) {
    const quantity = randomInt(minQty, maxQty)
    const selected = pickRandomCatalogItem(catalog.items)

    const orderResponse = await requestJson({
      method: 'POST',
      path: '/v2/orders',
      token,
      baseUrl,
      version,
      body: {
        idempotency_key: randomUUID(),
        order: {
          location_id: locationId,
          reference_id: `${merchantLabel}-${Date.now()}-${i}`,
          line_items: [
            {
              catalog_object_id: selected.variationId,
              quantity: String(quantity),
            },
          ],
        },
      },
    })

    const orderId = orderResponse.order?.id
    const orderTotal = orderResponse.order?.total_money?.amount
    const orderCurrency = orderResponse.order?.total_money?.currency ?? currency
    if (!orderId || typeof orderTotal !== 'number') {
      throw new Error('Order created but missing order.id or total_money.amount')
    }

    const paymentResponse = await requestJson({
      method: 'POST',
      path: '/v2/payments',
      token,
      baseUrl,
      version,
      body: {
        idempotency_key: randomUUID(),
        source_id: 'cnon:card-nonce-ok',
        autocomplete: true,
        amount_money: {
          amount: orderTotal,
          currency: orderCurrency,
        },
        location_id: locationId,
        order_id: orderId,
        note: `${notePrefix} #${i + 1} - ${selected.categoryName}/${selected.itemName}`,
      },
    })

    const paymentId = paymentResponse.payment?.id
    if (!paymentId) {
      throw new Error('Payment created but missing payment.id in response')
    }

    createdPayments.push(paymentId)
    console.log(
      `Created payment ${paymentId} total=${orderTotal} ${orderCurrency} (category=${selected.categoryName}, item=${selected.itemName}, qty=${quantity})`,
    )

    if (i < refundCount) {
      const refundPercent = randomInt(refundMinPercent, refundMaxPercent)
      const refundAmount = Math.max(1, Math.floor((orderTotal * refundPercent) / 100))

      const refundResponse = await requestJson({
        method: 'POST',
        path: '/v2/refunds',
        token,
        baseUrl,
        version,
        body: {
          idempotency_key: randomUUID(),
          payment_id: paymentId,
          amount_money: {
            amount: refundAmount,
            currency: orderCurrency,
          },
          reason: 'Small customer refund for testing',
        },
      })

      const refundId = refundResponse.refund?.id
      if (!refundId) {
        throw new Error('Refund created but missing refund.id in response')
      }

      createdRefunds.push(refundId)
      console.log(`Created refund ${refundId} amount=${refundAmount} ${orderCurrency} for payment=${paymentId}`)
    }

    await wait(sleepMs)
  }

  console.log('---')
  console.log('Square sandbox seed complete')
  console.log(`Catalog items available: ${catalog.items.length}`)
  console.log(`Payments created: ${createdPayments.length}`)
  console.log(`Refunds created: ${createdRefunds.length}`)
  console.log(`Location: ${locationId}`)
  console.log(`Date (UTC): ${new Date().toISOString().slice(0, 10)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
