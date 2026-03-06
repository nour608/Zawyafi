import {
  bytesToHex,
  consensusIdenticalAggregation,
  CronCapability,
  EVMClient,
  getNetwork,
  handler,
  hexToBase64,
  HTTPClient,
  Runner,
  type CronPayload,
  type HTTPSendRequester,
  type Runtime,
} from '@chainlink/cre-sdk'
import {
  concatHex,
  decodeFunctionResult,
  encodeFunctionData,
  hexToString,
  keccak256,
  parseAbi,
  stringToHex,
  toEventSelector,
} from 'viem'
import { z } from 'zod'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000'
const MAX_FILTER_LOG_RANGE_BLOCKS = 50_000n
const DEFAULT_SCAN_LOOKBACK_BLOCKS = 150_000n
const DEFAULT_MIN_CONFIRMATIONS = 3
const DEFAULT_RESULT_POST_MAX_ATTEMPTS = 2
const PERIOD_RECORDED_TOPIC0 = toEventSelector(
  'PeriodRecorded(bytes32,bytes32,bytes32,uint8,uint256,bytes32)',
)

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/
const REASON_CODES = new Set(['OK', 'REFUND_RATIO', 'SUDDEN_SPIKE', 'REFUND_AND_SPIKE'])
const TOPIC_FILTER_FALLBACK_ERROR = 'TOPIC_FILTER_UNSUPPORTED'

const revenueRegistryAbi = parseAbi([
  'function getPeriod(bytes32 periodId) view returns ((bytes32 periodId, bytes32 merchantIdHash, bytes32 productIdHash, uint64 periodStart, uint64 periodEnd, uint256 grossSales, uint256 refunds, uint256 netSales, uint256 unitsSold, uint256 refundUnits, uint256 netUnitsSold, uint256 eventCount, bytes32 batchHash, uint64 generatedAt, uint8 status, uint16 riskScore, bytes32 reasonCode))',
])

const isValidDateOnly = (value: string): boolean => {
  if (!DATE_ONLY_REGEX.test(value)) return false
  const parsed = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed)
}

const dateToStartSeconds = (value: string): bigint => {
  const parsed = Date.parse(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid date: ${value}`)
  }
  return BigInt(Math.floor(parsed / 1000))
}

const dateToEndSeconds = (value: string): bigint => {
  const parsed = Date.parse(`${value}T23:59:59.999Z`)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid date: ${value}`)
  }
  return BigInt(Math.floor(parsed / 1000))
}

const dateToEndIso = (value: string): string => {
  const parsed = Date.parse(`${value}T23:59:59.999Z`)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid date: ${value}`)
  }
  return new Date(parsed).toISOString()
}

const ReadyRecordSchema = z
  .object({
    requestId: z.string().trim().min(1),
    merchantIdHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    startDate: z.string(),
    endDate: z.string(),
  })
  .strict()
  .superRefine((record, ctx) => {
    if (!isValidDateOnly(record.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['startDate'],
        message: 'Must be a valid YYYY-MM-DD date',
      })
    }

    if (!isValidDateOnly(record.endDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'Must be a valid YYYY-MM-DD date',
      })
    }

    if (isValidDateOnly(record.startDate) && isValidDateOnly(record.endDate)) {
      if (dateToStartSeconds(record.startDate) > dateToEndSeconds(record.endDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['startDate'],
          message: 'Must be less than or equal to endDate',
        })
      }
    }
  })

const ReadyResponseSchema = z
  .object({
    records: z.array(z.unknown()),
  })
  .strict()

const configSchema = z.object({
  schedule: z.string(),
  backendBaseUrl: z.string().min(1),
  backendInternalToken: z.string().optional(),
  readyPath: z.string(),
  resultPath: z.string(),
  chainSelectorName: z.string(),
  isTestnet: z.boolean(),
  revenueRegistryAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  revenueRegistryDeployBlock: z.coerce.bigint(),
  maxBatch: z.coerce.number().int().positive(),
  scanLookbackBlocks: z.coerce.bigint().positive().optional(),
  minConfirmations: z.coerce.number().int().nonnegative().optional(),
  resultPostMaxAttempts: z.coerce.number().int().positive().optional(),
})

type Config = z.infer<typeof configSchema>
type ReadyRecord = z.infer<typeof ReadyRecordSchema>

interface ValuesBigInt {
  absVal: Uint8Array
  sign: bigint
}

interface ValuesBigIntJson {
  absVal: string
  sign: string
}

interface ComplianceReportPeriod {
  periodId: `0x${string}`
  merchantIdHash: `0x${string}`
  productIdHash: `0x${string}`
  periodStart: string
  periodEnd: string
  generatedAt: string
  grossSalesMinor: string
  refundsMinor: string
  netSalesMinor: string
  unitsSold: string
  refundUnits: string
  netUnitsSold: string
  eventCount: number
  status: 'VERIFIED' | 'UNVERIFIED'
  riskScore: number
  reasonCode: 'OK' | 'REFUND_RATIO' | 'SUDDEN_SPIKE' | 'REFUND_AND_SPIKE' | 'UNKNOWN'
  batchHash: `0x${string}`
  txHash: `0x${string}`
  blockNumber: string
  logIndex: number
}

interface ComplianceReportPacket {
  generatedAt: string
  merchantIdHash: string
  startDate: string
  endDate: string
  chainSelectorName: string
  revenueRegistryAddress: string
  scanFromBlock: string
  scanToBlock: string
  reportHash: `0x${string}`
  periodMerkleRoot: `0x${string}`
  totals: {
    periodCount: number
    grossSalesMinor: string
    refundsMinor: string
    netSalesMinor: string
    unitsSold: string
    refundUnits: string
    netUnitsSold: string
    verifiedCount: number
    unverifiedCount: number
  }
  periods: ComplianceReportPeriod[]
}

type ReportHashPayload = Omit<ComplianceReportPacket, 'reportHash'>

interface RunStats {
  processed: number
  failed: number
  callbackFailed: number
  requested: number
}

interface ScanBounds {
  fromBlock: bigint
  toBlock: bigint
}

const getSecretValue = (runtime: Runtime<Config>, id: string): string => {
  const attempts: Array<() => string> = [
    () => runtime.getSecret({ id, namespace: 'main' }).result().value,
    () => runtime.getSecret({ id }).result().value,
    () => runtime.getSecret({ id, namespace: 'default' }).result().value,
  ]

  for (const attempt of attempts) {
    try {
      return attempt()
    } catch {
      continue
    }
  }

  throw new Error(`Missing secret: ${id}`)
}

const sendJson = <T>(
  runtime: Runtime<Config>,
  request: {
    url: string
    method: string
    headers: Record<string, string>
    body?: Record<string, unknown>
  },
): T => {
  const httpClient = new HTTPClient()

  const responseText = httpClient
    .sendRequest(
      runtime,
      (sendRequester: HTTPSendRequester, req: typeof request) => {
        const bodyText = req.body ? JSON.stringify(req.body) : undefined

        const response = sendRequester
          .sendRequest({
            url: req.url,
            method: req.method,
            headers: req.headers,
            body: Buffer.from(bodyText ?? '', 'utf8').toString('base64'),
          })
          .result()

        const text = new TextDecoder().decode(response.body)
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw new Error(`HTTP ${req.method} ${req.url} failed with ${response.statusCode}: ${text}`)
        }

        return text
      },
      consensusIdenticalAggregation<string>(),
    )(request)
    .result()

  return JSON.parse(responseText || '{}') as T
}

const parseValuesBigInt = (value: ValuesBigInt | undefined): bigint => {
  if (!value) return 0n
  let magnitude = 0n
  for (const b of value.absVal) {
    magnitude = (magnitude << 8n) + BigInt(b)
  }
  if (value.sign < 0n) return -magnitude
  return magnitude
}

const toValuesBigIntJson = (value: bigint): ValuesBigIntJson => {
  const sign = value < 0n ? '-1' : value > 0n ? '1' : '0'
  const magnitude = value < 0n ? -value : value
  const hex = magnitude === 0n ? '0x00' : `0x${magnitude.toString(16).padStart(2, '0')}`
  return {
    absVal: hexToBase64(hex),
    sign,
  }
}

const toIsoDateTime = (seconds: bigint): string => new Date(Number(seconds) * 1000).toISOString()

const toSafeNumber = (value: bigint): number => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number.MAX_SAFE_INTEGER
  }
  if (value < 0n) {
    return 0
  }
  return Number(value)
}

const decodeReasonCode = (value: `0x${string}`): ComplianceReportPeriod['reasonCode'] => {
  try {
    const decoded = hexToString(value, { size: 32 }).replace(/\u0000/g, '').trim().toUpperCase()
    if (!decoded) return 'OK'
    if (REASON_CODES.has(decoded)) {
      return decoded as ComplianceReportPeriod['reasonCode']
    }
    return 'UNKNOWN'
  } catch {
    return 'UNKNOWN'
  }
}

const withinDateWindow = (periodStart: bigint, periodEnd: bigint, startDate: string, endDate: string): boolean => {
  const startSec = dateToStartSeconds(startDate)
  const endSec = dateToEndSeconds(endDate)
  return !(periodEnd < startSec || periodStart > endSec)
}

const computeMerkleRoot = (periodIds: `0x${string}`[]): `0x${string}` => {
  if (periodIds.length === 0) {
    return ZERO_BYTES32
  }

  let level = [...periodIds].sort((a, b) => a.localeCompare(b))
  while (level.length > 1) {
    const next: `0x${string}`[] = []
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]
      const right = level[i + 1] ?? left
      const ordered = left.localeCompare(right) <= 0 ? [left, right] : [right, left]
      next.push(keccak256(concatHex([ordered[0], ordered[1]])))
    }
    level = next
  }

  return level[0]
}

const computeScanBounds = (
  latestBlock: bigint,
  deployBlock: bigint,
  lookbackBlocks: bigint,
  minConfirmations: number,
): ScanBounds => {
  const confirmations = BigInt(minConfirmations)
  const safeHead = latestBlock > confirmations ? latestBlock - confirmations : 0n
  const lookbackFloor = safeHead >= lookbackBlocks - 1n ? safeHead - lookbackBlocks + 1n : 0n
  const fromBlock = lookbackFloor > deployBlock ? lookbackFloor : deployBlock

  return {
    fromBlock,
    toBlock: safeHead,
  }
}

const getDeterministicGeneratedAt = (periods: ComplianceReportPeriod[], endDate: string): string => {
  if (periods.length === 0) {
    return dateToEndIso(endDate)
  }

  let latest = periods[0].generatedAt
  for (const period of periods) {
    if (period.generatedAt > latest) {
      latest = period.generatedAt
    }
  }
  return latest
}

const computeReportHash = (payloadForHash: ReportHashPayload): `0x${string}` => {
  return keccak256(stringToHex(JSON.stringify(payloadForHash)))
}

const formatZodIssues = (error: z.ZodError): string => {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}

const extractFallbackRequestId = (record: unknown): string => {
  if (!record || typeof record !== 'object') return ''
  const requestId = (record as Record<string, unknown>).requestId
  return typeof requestId === 'string' ? requestId : ''
}

const getUrlProtocol = (url: string): string => {
  const normalized = url.trim().toLowerCase()
  if (normalized.startsWith('https://')) return 'https:'
  if (normalized.startsWith('http://')) return 'http:'
  throw new Error(`Invalid backendBaseUrl: ${url}`)
}

const validateRuntimeConfig = (runtime: Runtime<Config>): void => {
  const protocol = getUrlProtocol(runtime.config.backendBaseUrl)
  if (protocol !== 'https:') {
    if (runtime.config.isTestnet) {
      runtime.log(`WARNING: backendBaseUrl is not HTTPS: ${runtime.config.backendBaseUrl}`)
    } else {
      throw new Error(`backendBaseUrl must use HTTPS in production: ${runtime.config.backendBaseUrl}`)
    }
  }

  if (!runtime.config.isTestnet && runtime.config.revenueRegistryAddress.toLowerCase() === ZERO_ADDRESS) {
    throw new Error('revenueRegistryAddress must not be zero on non-testnet deployments')
  }
}

const getScanLookbackBlocks = (runtime: Runtime<Config>): bigint => {
  return runtime.config.scanLookbackBlocks ?? DEFAULT_SCAN_LOOKBACK_BLOCKS
}

const getMinConfirmations = (runtime: Runtime<Config>): number => {
  return runtime.config.minConfirmations ?? DEFAULT_MIN_CONFIRMATIONS
}

const getResultPostMaxAttempts = (runtime: Runtime<Config>): number => {
  return runtime.config.resultPostMaxAttempts ?? DEFAULT_RESULT_POST_MAX_ATTEMPTS
}

const postResultWithRetry = (
  runtime: Runtime<Config>,
  backendToken: string,
  body: Record<string, unknown>,
): void => {
  let lastError: Error | null = null
  const maxAttempts = getResultPostMaxAttempts(runtime)

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      sendJson(runtime, {
        url: `${runtime.config.backendBaseUrl}${runtime.config.resultPath}`,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${backendToken}`,
        },
        body,
      })

      if (attempt > 1) {
        runtime.log(`Result callback succeeded on retry attempt ${attempt}`)
      }
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      lastError = new Error(message)
      runtime.log(`Result callback attempt ${attempt}/${maxAttempts} failed: ${message}`)
    }
  }

  throw new Error(`Result callback failed after ${maxAttempts} attempts: ${lastError?.message}`)
}

const filterPeriodRecordedLogs = (
  runtime: Runtime<Config>,
  evmClient: EVMClient,
  fromBlock: bigint,
  toBlock: bigint,
  merchantIdHash: `0x${string}`,
) => {
  const logs: Array<{
    removed: boolean
    topics: Uint8Array[]
    txHash: Uint8Array
    blockNumber?: ValuesBigInt
    index: number
  }> = []

  if (fromBlock > toBlock) {
    return logs
  }

  const eventOnlyTopics = [{ topic: [hexToBase64(PERIOD_RECORDED_TOPIC0)] }]
  const eventAndMerchantTopics = [
    { topic: [hexToBase64(PERIOD_RECORDED_TOPIC0)] },
    { topic: [] },
    { topic: [hexToBase64(merchantIdHash)] },
  ]

  let useMerchantTopicFilter = true
  let cursor = fromBlock

  while (cursor <= toBlock) {
    const chunkToBlock = cursor + (MAX_FILTER_LOG_RANGE_BLOCKS - 1n)
    const chunkEnd = chunkToBlock < toBlock ? chunkToBlock : toBlock

    const runFilter = (topics: Array<{ topic: string[] }>) =>
      evmClient
        .filterLogs(runtime, {
          filterQuery: {
            fromBlock: toValuesBigIntJson(cursor),
            toBlock: toValuesBigIntJson(chunkEnd),
            addresses: [hexToBase64(runtime.config.revenueRegistryAddress)],
            topics,
          },
        })
        .result()

    let response
    if (useMerchantTopicFilter) {
      try {
        response = runFilter(eventAndMerchantTopics)
      } catch {
        useMerchantTopicFilter = false
        runtime.log(`Topic-level merchant filter unavailable, falling back (${TOPIC_FILTER_FALLBACK_ERROR})`)
        response = runFilter(eventOnlyTopics)
      }
    } else {
      response = runFilter(eventOnlyTopics)
    }

    logs.push(...(response.logs ?? []))
    cursor = chunkEnd + 1n
  }

  return logs
}

const buildReportForRecord = (
  runtime: Runtime<Config>,
  evmClient: EVMClient,
  record: ReadyRecord,
): ComplianceReportPacket => {
  const latestHeader = evmClient.headerByNumber(runtime, {}).result().header
  const latestBlock = parseValuesBigInt((latestHeader?.blockNumber as ValuesBigInt | undefined) ?? undefined)
  const scanBounds = computeScanBounds(
    latestBlock,
    runtime.config.revenueRegistryDeployBlock,
    getScanLookbackBlocks(runtime),
    getMinConfirmations(runtime),
  )

  runtime.log(
    `Scanning compliance logs for request=${record.requestId} merchant=${record.merchantIdHash.toLowerCase()} fromBlock=${scanBounds.fromBlock} toBlock=${scanBounds.toBlock}`,
  )

  const logs = filterPeriodRecordedLogs(
    runtime,
    evmClient,
    scanBounds.fromBlock,
    scanBounds.toBlock,
    record.merchantIdHash.toLowerCase() as `0x${string}`,
  )

  runtime.log(`Scan complete request=${record.requestId} totalLogs=${logs.length}`)

  const periodLogMap = new Map<
    `0x${string}`,
    {
      txHash: `0x${string}`
      blockNumber: string
      logIndex: number
      merchantIdHash: `0x${string}`
    }
  >()

  for (const log of logs) {
    if (log.removed) {
      continue
    }

    const topics = log.topics.map((topic: Uint8Array) => bytesToHex(topic).toLowerCase() as `0x${string}`)
    if (topics.length < 3 || topics[0] !== PERIOD_RECORDED_TOPIC0.toLowerCase()) {
      continue
    }

    const periodId = topics[1]
    const merchantIdHash = topics[2]
    if (merchantIdHash !== record.merchantIdHash.toLowerCase()) {
      continue
    }

    const blockNumber = parseValuesBigInt((log.blockNumber as ValuesBigInt | undefined) ?? undefined).toString()
    periodLogMap.set(periodId, {
      txHash: bytesToHex(log.txHash),
      blockNumber,
      logIndex: log.index,
      merchantIdHash,
    })
  }

  runtime.log(`Matched period logs request=${record.requestId} uniquePeriods=${periodLogMap.size}`)

  const periods: ComplianceReportPeriod[] = []
  for (const [periodId, logMeta] of periodLogMap.entries()) {
    const callData = encodeFunctionData({
      abi: revenueRegistryAbi,
      functionName: 'getPeriod',
      args: [periodId],
    })

    const callResult = evmClient
      .callContract(runtime, {
        call: {
          from: hexToBase64(ZERO_ADDRESS),
          to: hexToBase64(runtime.config.revenueRegistryAddress),
          data: hexToBase64(callData),
        },
      })
      .result()

    const decoded = decodeFunctionResult({
      abi: revenueRegistryAbi,
      functionName: 'getPeriod',
      data: bytesToHex(callResult.data),
    })

    const report = decoded as {
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

    if (!withinDateWindow(report.periodStart, report.periodEnd, record.startDate, record.endDate)) {
      continue
    }

    periods.push({
      periodId: report.periodId,
      merchantIdHash: report.merchantIdHash,
      productIdHash: report.productIdHash,
      periodStart: toIsoDateTime(report.periodStart),
      periodEnd: toIsoDateTime(report.periodEnd),
      generatedAt: toIsoDateTime(report.generatedAt),
      grossSalesMinor: report.grossSales.toString(),
      refundsMinor: report.refunds.toString(),
      netSalesMinor: report.netSales.toString(),
      unitsSold: report.unitsSold.toString(),
      refundUnits: report.refundUnits.toString(),
      netUnitsSold: report.netUnitsSold.toString(),
      eventCount: toSafeNumber(report.eventCount),
      status: Number(report.status) === 1 ? 'VERIFIED' : 'UNVERIFIED',
      riskScore: Number(report.riskScore),
      reasonCode: decodeReasonCode(report.reasonCode),
      batchHash: report.batchHash,
      txHash: logMeta.txHash,
      blockNumber: logMeta.blockNumber,
      logIndex: logMeta.logIndex,
    })
  }

  periods.sort((left, right) => {
    if (left.generatedAt === right.generatedAt) {
      return left.periodId.localeCompare(right.periodId)
    }
    return left.generatedAt > right.generatedAt ? -1 : 1
  })

  const totals = periods.reduce(
    (acc, period) => {
      acc.periodCount += 1
      acc.grossSalesMinor += BigInt(period.grossSalesMinor)
      acc.refundsMinor += BigInt(period.refundsMinor)
      acc.netSalesMinor += BigInt(period.netSalesMinor)
      acc.unitsSold += BigInt(period.unitsSold)
      acc.refundUnits += BigInt(period.refundUnits)
      acc.netUnitsSold += BigInt(period.netUnitsSold)
      if (period.status === 'VERIFIED') {
        acc.verifiedCount += 1
      } else {
        acc.unverifiedCount += 1
      }
      return acc
    },
    {
      periodCount: 0,
      grossSalesMinor: 0n,
      refundsMinor: 0n,
      netSalesMinor: 0n,
      unitsSold: 0n,
      refundUnits: 0n,
      netUnitsSold: 0n,
      verifiedCount: 0,
      unverifiedCount: 0,
    },
  )

  const periodMerkleRoot = computeMerkleRoot(periods.map((period) => period.periodId))

  const payloadForHash: ReportHashPayload = {
    generatedAt: getDeterministicGeneratedAt(periods, record.endDate),
    merchantIdHash: record.merchantIdHash.toLowerCase(),
    startDate: record.startDate,
    endDate: record.endDate,
    chainSelectorName: runtime.config.chainSelectorName,
    revenueRegistryAddress: runtime.config.revenueRegistryAddress,
    scanFromBlock: scanBounds.fromBlock.toString(),
    scanToBlock: scanBounds.toBlock.toString(),
    periodMerkleRoot,
    totals: {
      periodCount: totals.periodCount,
      grossSalesMinor: totals.grossSalesMinor.toString(),
      refundsMinor: totals.refundsMinor.toString(),
      netSalesMinor: totals.netSalesMinor.toString(),
      unitsSold: totals.unitsSold.toString(),
      refundUnits: totals.refundUnits.toString(),
      netUnitsSold: totals.netUnitsSold.toString(),
      verifiedCount: totals.verifiedCount,
      unverifiedCount: totals.unverifiedCount,
    },
    periods,
  }

  const reportHash = computeReportHash(payloadForHash)

  return {
    ...payloadForHash,
    reportHash,
  }
}

const onCronTrigger = (runtime: Runtime<Config>, _payload: CronPayload): string => {
  validateRuntimeConfig(runtime)

  const backendToken =
    runtime.config.backendInternalToken?.trim() ||
    getSecretValue(runtime, 'BACKEND_INTERNAL_TOKEN')

  const readyRaw = sendJson<unknown>(runtime, {
    url: `${runtime.config.backendBaseUrl}${runtime.config.readyPath}?limit=${runtime.config.maxBatch}`,
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${backendToken}`,
    },
  })

  const readyParsed = ReadyResponseSchema.safeParse(readyRaw)
  if (!readyParsed.success) {
    throw new Error(`Invalid ready response: ${formatZodIssues(readyParsed.error)}`)
  }

  const stats: RunStats = {
    processed: 0,
    failed: 0,
    callbackFailed: 0,
    requested: readyParsed.data.records.length,
  }

  if (stats.requested === 0) {
    runtime.log('No pending compliance report requests')
    runtime.log(`Compliance export stats: ${JSON.stringify(stats)}`)
    return JSON.stringify(stats)
  }

  const network = getNetwork({
    chainFamily: 'evm',
    chainSelectorName: runtime.config.chainSelectorName,
    isTestnet: runtime.config.isTestnet,
  })

  if (!network) {
    throw new Error(`Network not found: ${runtime.config.chainSelectorName}`)
  }

  const evmClient = new EVMClient(network.chainSelector.selector)

  for (const rawRecord of readyParsed.data.records) {
    const parsedRecord = ReadyRecordSchema.safeParse(rawRecord)
    if (!parsedRecord.success) {
      const requestId = extractFallbackRequestId(rawRecord)
      const errorMessage = formatZodIssues(parsedRecord.error)
      stats.failed += 1
      runtime.log(`Invalid compliance ready record requestId=${requestId || '<unknown>'}: ${errorMessage}`)

      try {
        postResultWithRetry(runtime, backendToken, {
          requestId,
          outcome: 'RETRYABLE',
          errorCode: 'INVALID_READY_RECORD',
          errorMessage,
        })
      } catch (callbackError) {
        stats.callbackFailed += 1
        const callbackMessage = callbackError instanceof Error ? callbackError.message : String(callbackError)
        runtime.log(
          `Failed to report invalid-record result requestId=${requestId || '<unknown>'}: ${callbackMessage}`,
        )
      }
      continue
    }

    const record = parsedRecord.data

    try {
      const report = buildReportForRecord(runtime, evmClient, record)

      try {
        postResultWithRetry(runtime, backendToken, {
          requestId: record.requestId,
          outcome: 'SUCCESS',
          report,
        })
        runtime.log(
          `Compliance report generated for ${record.requestId}: periods=${report.totals.periodCount}, hash=${report.reportHash}`,
        )
        stats.processed += 1
      } catch (callbackError) {
        stats.callbackFailed += 1
        stats.failed += 1
        const callbackMessage = callbackError instanceof Error ? callbackError.message : String(callbackError)
        runtime.log(`Compliance callback failed after report generation for ${record.requestId}: ${callbackMessage}`)
      }
    } catch (error) {
      stats.failed += 1
      const errorMessage = error instanceof Error ? error.message : String(error)
      runtime.log(`Compliance report failed for ${record.requestId}: ${errorMessage}`)

      try {
        postResultWithRetry(runtime, backendToken, {
          requestId: record.requestId,
          outcome: 'RETRYABLE',
          errorCode: 'WORKFLOW_EXCEPTION',
          errorMessage,
        })
      } catch (callbackError) {
        stats.callbackFailed += 1
        const callbackMessage = callbackError instanceof Error ? callbackError.message : String(callbackError)
        runtime.log(`Failed to report retryable result for ${record.requestId}: ${callbackMessage}`)
      }
    }
  }

  runtime.log(`Compliance export stats: ${JSON.stringify(stats)}`)
  return JSON.stringify(stats)
}

export const __test__ = {
  ReadyRecordSchema,
  computeReportHash,
  computeScanBounds,
  decodeReasonCode,
  getUrlProtocol,
  getDeterministicGeneratedAt,
  isValidDateOnly,
  withinDateWindow,
}

export async function main() {
  const runner = await Runner.newRunner<Config>({
    configSchema,
  })

  await runner.run((config: Config) => {
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
