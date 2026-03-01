import {
  bytesToHex,
  ConfidentialHTTPClient,
  ConsensusAggregationByFields,
  CronCapability,
  EVMClient,
  getNetwork,
  handler,
  hexToBase64,
  HTTPClient,
  identical,
  median,
  Runner,
  type CronPayload,
  type NodeRuntime,
  type Runtime,
  TxStatus,
} from '@chainlink/cre-sdk'
import { encodeAbiParameters, keccak256, parseAbiParameters, stringToBytes, stringToHex } from 'viem'
import { z } from 'zod'

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000'
const VERIFIED_STATUS = 1
const UNVERIFIED_STATUS = 0
const REASON_OK = stringToHex('OK', { size: 32 })
const REASON_REFUND_RATIO = stringToHex('REFUND_RATIO', { size: 32 })
const REASON_SUDDEN_SPIKE = stringToHex('SUDDEN_SPIKE', { size: 32 })
const REASON_REFUND_AND_SPIKE = stringToHex('REFUND_AND_SPIKE', { size: 32 })

const configSchema = z.object({
  schedule: z.string().describe('Cron schedule for the workflow'),
  squareBaseUrl: z.string().describe('Square API Base URL'),
  squareVersion: z.string().describe('Square API Version'),
  locationId: z.string().describe('Square Location ID'),
  merchantId: z.string().describe('Merchant ID for Square'),
  category: z.string().describe('Product category for report identity'),
  batchId: z.coerce.bigint().describe('Batch ID associated with this revenue'),
  oracleCoordinatorAddress: z.string().describe('Address of the OracleCoordinator contract'),
  chainSelectorName: z.string().describe('Chain selector name for the target network'),
  isTestnet: z.boolean().describe('Whether target chain is testnet'),
  gasLimit: z.string().describe('Gas limit for the transaction'),
  anomalyRefundRatioBpsThreshold: z
    .number()
    .int()
    .min(1)
    .max(10_000)
    .describe('Refund ratio threshold in basis points to mark period as anomalous'),
  anomalyNetSalesSpikeCentsThreshold: z
    .coerce
    .bigint()
    .describe('Absolute net-sales threshold in cents to mark period as sudden-spike anomaly'),
  skipWrite: z.boolean().describe('If true, run fetch+consensus only and skip onchain write'),
})

type Config = z.infer<typeof configSchema>

interface SquarePayment {
  id: string
  status: string
  note?: string
  amount_money?: {
    amount: number
    currency: string
  }
}

interface SquareRefund {
  id: string
  status: string
  payment_id?: string
  amount_money?: {
    amount: number
    currency: string
  }
}

type SquarePaymentsPage = {
  payments?: SquarePayment[]
  cursor?: string
}

type SquareRefundsPage = {
  refunds?: SquareRefund[]
  cursor?: string
}

interface QueryWindow {
  beginIso: string
  endIso: string
  periodStartSec: number
  periodEndSec: number
  generatedAtSec: number
}

interface PeriodReport {
  periodId: `0x${string}`
  merchantIdHash: `0x${string}`
  productIdHash: `0x${string}`
  periodStart: bigint
  periodEnd: bigint
  grossSales: bigint
  refunds: bigint
  netSales: bigint
  unitsSold: bigint
  refundUnits: bigint
  netUnitsSold: bigint
  eventCount: bigint
  batchHash: `0x${string}`
  generatedAt: bigint
  status: number
  riskScore: number
  reasonCode: `0x${string}`
}

type ReportLogView = {
  periodId: string
  merchantIdHash: string
  productIdHash: string
  periodStart: string
  periodEnd: string
  grossSales: string
  refunds: string
  netSales: string
  unitsSold: string
  refundUnits: string
  netUnitsSold: string
  eventCount: string
  batchHash: string
  generatedAt: string
  status: number
  riskScore: number
  reasonCode: string
}

const periodReportAndBatchParams = parseAbiParameters(
  '(bytes32 periodId, bytes32 merchantIdHash, bytes32 productIdHash, uint64 periodStart, uint64 periodEnd, uint256 grossSales, uint256 refunds, uint256 netSales, uint256 unitsSold, uint256 refundUnits, uint256 netUnitsSold, uint256 eventCount, bytes32 batchHash, uint64 generatedAt, uint8 status, uint16 riskScore, bytes32 reasonCode) report, uint256 batchId',
)

const inferCategoryFromNote = (note?: string): string | undefined => {
  if (!note) return undefined
  const slashIndex = note.lastIndexOf('/')
  const dashIndex = note.lastIndexOf(' - ')
  if (slashIndex <= 0 || dashIndex < 0 || slashIndex <= dashIndex + 3) return undefined
  return note.slice(dashIndex + 3, slashIndex).trim()
}

const decodeJsonBody = <T>(body: Uint8Array): T => {
  const text = new TextDecoder().decode(body)
  return JSON.parse(text) as T
}

const buildSquareUrl = (
  baseUrl: string,
  endpoint: string,
  query: Record<string, string | undefined>,
): string => {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const queryParts: string[] = []

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    }
  }

  if (queryParts.length === 0) {
    return `${normalizedBase}${normalizedEndpoint}`
  }

  return `${normalizedBase}${normalizedEndpoint}?${queryParts.join('&')}`
}

const sendSquareGet = <T>(
  nodeRuntime: NodeRuntime<Config>,
  httpClient: HTTPClient,
  config: Config,
  url: string,
  squareToken?: string,
): T => {
  if (squareToken) {
    const response = httpClient
      .sendRequest(nodeRuntime, {
        method: 'GET',
        url,
        headers: {
          Authorization: `Bearer ${squareToken}`,
          'Square-Version': config.squareVersion,
          Accept: 'application/json',
        },
      })
      .result()

    if (response.statusCode !== 200) {
      const bodyText = new TextDecoder().decode(response.body)
      throw new Error(`Square API request failed with status ${response.statusCode}: ${bodyText}`)
    }

    return decodeJsonBody<T>(response.body)
  }

  const confidentialHttpClient = new ConfidentialHTTPClient()
  let lastError: unknown
  for (const namespace of ['main', '']) {
    try {
      const response = confidentialHttpClient
        .sendRequest(nodeRuntime, {
          request: {
            method: 'GET',
            url,
            multiHeaders: {
              Authorization: { values: ['Bearer {{.SQUARE_PAT}}'] },
              'Square-Version': { values: [config.squareVersion] },
              Accept: { values: ['application/json'] },
            },
          },
          vaultDonSecrets: [
            {
              key: 'SQUARE_PAT',
              namespace,
            },
          ],
        })
        .result()

      if (response.statusCode !== 200) {
        const bodyText = new TextDecoder().decode(response.body)
        throw new Error(`Square API request failed with status ${response.statusCode}: ${bodyText}`)
      }

      return decodeJsonBody<T>(response.body)
    } catch (err) {
      lastError = err
    }
  }

  throw new Error(`Square API confidential request failed: ${String(lastError)}`)
}

const fetchSquarePayments = (
  nodeRuntime: NodeRuntime<Config>,
  httpClient: HTTPClient,
  config: Config,
  window: QueryWindow,
  squareToken?: string,
): SquarePayment[] => {
  const payments: SquarePayment[] = []
  let cursor: string | undefined

  do {
    const url = buildSquareUrl(config.squareBaseUrl, '/v2/payments', {
      begin_time: window.beginIso,
      end_time: window.endIso,
      location_id: config.locationId,
      sort_order: 'ASC',
      cursor,
    })
    const page = sendSquareGet<SquarePaymentsPage>(nodeRuntime, httpClient, config, url, squareToken)
    payments.push(...(page.payments ?? []))
    cursor = page.cursor
  } while (cursor)

  return payments
}

const fetchSquareRefunds = (
  nodeRuntime: NodeRuntime<Config>,
  httpClient: HTTPClient,
  config: Config,
  window: QueryWindow,
  squareToken?: string,
): SquareRefund[] => {
  const refunds: SquareRefund[] = []
  let cursor: string | undefined

  do {
    const url = buildSquareUrl(config.squareBaseUrl, '/v2/refunds', {
      begin_time: window.beginIso,
      end_time: window.endIso,
      location_id: config.locationId,
      sort_order: 'ASC',
      cursor,
    })
    const page = sendSquareGet<SquareRefundsPage>(nodeRuntime, httpClient, config, url, squareToken)
    refunds.push(...(page.refunds ?? []))
    cursor = page.cursor
  } while (cursor)

  return refunds
}

const fetchCafeRevenueFromSquare = (
  nodeRuntime: NodeRuntime<Config>,
  window: QueryWindow,
  squareToken?: string,
): PeriodReport => {
  const config = nodeRuntime.config

  const httpClient = new HTTPClient()
  const categoryFilter = config.category.trim().toLowerCase()
  const payments = fetchSquarePayments(nodeRuntime, httpClient, config, window, squareToken)
  const refunds = fetchSquareRefunds(nodeRuntime, httpClient, config, window, squareToken)
  let completedPayments = 0

  let grossSales = 0n
  let unitsSold = 0n
  const selectedPaymentIds = new Set<string>()

  for (const payment of payments) {
    if (payment.status !== 'COMPLETED') continue
    completedPayments += 1

    const category = inferCategoryFromNote(payment.note)?.toLowerCase()
    if (category !== categoryFilter) continue

    grossSales += BigInt(payment.amount_money?.amount ?? 0)
    unitsSold += 1n
    selectedPaymentIds.add(payment.id)
  }

  let refundAmount = 0n
  let matchedRefundEvents = 0n
  let completedRefunds = 0
  const refundedPaymentIds = new Set<string>()

  for (const refund of refunds) {
    if (refund.status !== 'COMPLETED') continue
    completedRefunds += 1
    if (!refund.payment_id || !selectedPaymentIds.has(refund.payment_id)) continue

    refundAmount += BigInt(refund.amount_money?.amount ?? 0)
    refundedPaymentIds.add(refund.payment_id)
    matchedRefundEvents += 1n
  }

  const refundUnits = BigInt(refundedPaymentIds.size)
  if (refundAmount > grossSales) {
    throw new Error('Refunds exceed gross sales for the selected period')
  }

  const netSales = grossSales - refundAmount
  const netUnitsSold = unitsSold - refundUnits
  const eventCount = BigInt(selectedPaymentIds.size) + matchedRefundEvents
  const refundRatioBps = grossSales > 0n ? Number((refundAmount * 10_000n) / grossSales) : 0
  const refundRatioFlagged = refundRatioBps >= config.anomalyRefundRatioBpsThreshold
  const suddenSpikeFlagged = netSales >= config.anomalyNetSalesSpikeCentsThreshold
  const flagged = refundRatioFlagged || suddenSpikeFlagged
  const status = flagged ? UNVERIFIED_STATUS : VERIFIED_STATUS

  let riskScore = 0
  if (refundRatioFlagged) {
    riskScore += Math.min(700, Math.max(250, Math.floor(refundRatioBps / 10)))
  }
  if (suddenSpikeFlagged) {
    riskScore += 350
  }
  riskScore = Math.min(riskScore, 1000)

  let reasonCode = REASON_OK
  if (refundRatioFlagged && suddenSpikeFlagged) {
    reasonCode = REASON_REFUND_AND_SPIKE
  } else if (refundRatioFlagged) {
    reasonCode = REASON_REFUND_RATIO
  } else if (suddenSpikeFlagged) {
    reasonCode = REASON_SUDDEN_SPIKE
  }

  const merchantIdHash = keccak256(stringToBytes(config.merchantId))
  const productIdHash = keccak256(stringToBytes(config.category))
  const periodStart = BigInt(window.periodStartSec)
  const periodEnd = BigInt(window.periodEndSec)
  const batchHash = keccak256(encodeAbiParameters(parseAbiParameters('uint256'), [config.batchId]))
  const periodId = keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, bytes32, uint64, uint64'),
      [merchantIdHash, productIdHash, periodStart, periodEnd],
    ),
  )

  nodeRuntime.log(
    `Square node fetch summary: payments_total=${payments.length}, payments_completed=${completedPayments}, payments_selected=${selectedPaymentIds.size}, refunds_total=${refunds.length}, refunds_completed=${completedRefunds}, refunds_matched=${Number(matchedRefundEvents)}`,
  )
  nodeRuntime.log(
    `Square node computed amounts(cents): gross=${grossSales.toString()}, refunds=${refundAmount.toString()}, net=${netSales.toString()}, units=${unitsSold.toString()}, refundUnits=${refundUnits.toString()}, netUnits=${netUnitsSold.toString()}`,
  )
  nodeRuntime.log(
    `Anomaly evaluation: refundRatioBps=${refundRatioBps}, refundRatioThresholdBps=${config.anomalyRefundRatioBpsThreshold}, netSales=${netSales.toString()}, netSalesSpikeThreshold=${config.anomalyNetSalesSpikeCentsThreshold.toString()}, flagged=${flagged}, status=${status}, riskScore=${riskScore}`,
  )

  return {
    periodId,
    merchantIdHash,
    productIdHash,
    periodStart,
    periodEnd,
    grossSales,
    refunds: refundAmount,
    netSales,
    unitsSold,
    refundUnits,
    netUnitsSold,
    eventCount,
    batchHash,
    generatedAt: BigInt(window.generatedAtSec),
    status,
    riskScore,
    reasonCode,
  }
}

const toReportLogView = (report: PeriodReport): ReportLogView => ({
  periodId: report.periodId,
  merchantIdHash: report.merchantIdHash,
  productIdHash: report.productIdHash,
  periodStart: report.periodStart.toString(),
  periodEnd: report.periodEnd.toString(),
  grossSales: report.grossSales.toString(),
  refunds: report.refunds.toString(),
  netSales: report.netSales.toString(),
  unitsSold: report.unitsSold.toString(),
  refundUnits: report.refundUnits.toString(),
  netUnitsSold: report.netUnitsSold.toString(),
  eventCount: report.eventCount.toString(),
  batchHash: report.batchHash,
  generatedAt: report.generatedAt.toString(),
  status: report.status,
  riskScore: report.riskScore,
  reasonCode: report.reasonCode,
})

const submitReport = (runtime: Runtime<Config>, report: PeriodReport): string => {
  const network = getNetwork({
    chainFamily: 'evm',
    chainSelectorName: runtime.config.chainSelectorName,
    isTestnet: runtime.config.isTestnet,
  })

  if (!network) {
    throw new Error(`Network not found for chain selector name: ${runtime.config.chainSelectorName}`)
  }

  const encodedReport = encodeAbiParameters(periodReportAndBatchParams, [report, runtime.config.batchId])
  const reportResponse = runtime
    .report({
      encodedPayload: hexToBase64(encodedReport),
      encoderName: 'evm',
      signingAlgo: 'ecdsa',
      hashingAlgo: 'keccak256',
    })
    .result()

  const evmClient = new EVMClient(network.chainSelector.selector)
  const writeResponse = evmClient
    .writeReport(runtime, {
      receiver: runtime.config.oracleCoordinatorAddress,
      report: reportResponse,
      gasConfig: {
        gasLimit: runtime.config.gasLimit,
      },
    })
    .result()

  if (writeResponse.txStatus !== TxStatus.SUCCESS) {
    throw new Error(`Transaction failed: ${writeResponse.errorMessage || writeResponse.txStatus}`)
  }

  const txHash = bytesToHex(writeResponse.txHash || new Uint8Array(32))
  runtime.log(`Transaction submitted: ${txHash}`)
  return txHash
}

const getScheduledDate = (runtime: Runtime<Config>, payload: CronPayload): Date => {
  const rawTimestamp = payload.scheduledExecutionTime as
    | {
        seconds?: bigint | number
        nanos?: number
      }
    | undefined

  if (!rawTimestamp?.seconds) {
    return runtime.now()
  }

  const seconds =
    typeof rawTimestamp.seconds === 'bigint'
      ? Number(rawTimestamp.seconds)
      : rawTimestamp.seconds
  const nanos = rawTimestamp.nanos ?? 0

  if (!Number.isFinite(seconds)) {
    return runtime.now()
  }

  return new Date(seconds * 1000 + nanos / 1_000_000)
}

const getPreviousUtcDayWindow = (referenceDate: Date): QueryWindow => {
  const year = referenceDate.getUTCFullYear()
  const month = referenceDate.getUTCMonth()
  const day = referenceDate.getUTCDate()

  const start = new Date(Date.UTC(year, month, day - 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, month, day - 1, 23, 59, 59, 999))
  const periodStartSec = Math.floor(start.getTime() / 1000)
  const periodEndSec = Math.floor(end.getTime() / 1000)
  const generatedAtSec = Math.max(Math.floor(referenceDate.getTime() / 1000), periodEndSec)

  return {
    beginIso: start.toISOString(),
    endIso: end.toISOString(),
    periodStartSec,
    periodEndSec,
    generatedAtSec,
  }
}

const onCronTrigger = (runtime: Runtime<Config>, payload: CronPayload): string => {
  const scheduledDate = getScheduledDate(runtime, payload)
  const window = getPreviousUtcDayWindow(scheduledDate)
  let squareToken: string | undefined
  try {
    squareToken = runtime.getSecret({ id: 'SQUARE_PAT', namespace: 'main' }).result().value
  } catch {
    try {
      squareToken = runtime.getSecret({ id: 'SQUARE_PAT' }).result().value
    } catch {
      squareToken = undefined
      runtime.log('runtime.getSecret for SQUARE_PAT failed; using confidential-http secret injection fallback')
    }
  }

  runtime.log(
    `Fetching Square data from ${window.beginIso} to ${window.endIso} for category ${runtime.config.category}`,
  )

  const report = runtime
    .runInNodeMode(
      fetchCafeRevenueFromSquare,
      ConsensusAggregationByFields<PeriodReport>({
        periodId: identical,
        merchantIdHash: identical,
        productIdHash: identical,
        periodStart: identical,
        periodEnd: identical,
        grossSales: median,
        refunds: median,
        netSales: median,
        unitsSold: median,
        refundUnits: median,
        netUnitsSold: median,
        eventCount: median,
        batchHash: identical,
        generatedAt: median,
        status: identical,
        riskScore: identical,
        reasonCode: identical,
      }),
    )(window, squareToken)
    .result()

  runtime.log(`CRE aggregated report: ${JSON.stringify(toReportLogView(report))}`)

  if (runtime.config.skipWrite) {
    runtime.log('skipWrite=true, not sending report onchain')
    return JSON.stringify({
      skippedWrite: true,
      batchId: runtime.config.batchId.toString(),
      report: toReportLogView(report),
    })
  }

  return submitReport(runtime, report)
}

export async function main() {
  const runner = await Runner.newRunner<Config>({
    configSchema,
  })

  await runner.run((config) => {
    const cron = new CronCapability()
    return [
      handler(
        cron.trigger({
          schedule: config.schedule,
        }),
        onCronTrigger,
      ),
    ]
  })
}
