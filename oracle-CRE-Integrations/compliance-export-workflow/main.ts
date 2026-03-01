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
const PERIOD_RECORDED_TOPIC0 = toEventSelector(
  'PeriodRecorded(bytes32,bytes32,bytes32,uint8,uint256,bytes32)',
)

const reasonCodes = new Set(['OK', 'REFUND_RATIO', 'SUDDEN_SPIKE', 'REFUND_AND_SPIKE'])

const revenueRegistryAbi = parseAbi([
  'function getPeriod(bytes32 periodId) view returns ((bytes32 periodId, bytes32 merchantIdHash, bytes32 productIdHash, uint64 periodStart, uint64 periodEnd, uint256 grossSales, uint256 refunds, uint256 netSales, uint256 unitsSold, uint256 refundUnits, uint256 netUnitsSold, uint256 eventCount, bytes32 batchHash, uint64 generatedAt, uint8 status, uint16 riskScore, bytes32 reasonCode))',
])

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
  gaslessReadMode: z.boolean(),
})

type Config = z.infer<typeof configSchema>

interface ValuesBigInt {
  absVal: Uint8Array
  sign: bigint
}

interface ValuesBigIntJson {
  absVal: string
  sign: string
}

interface ReadyRecord {
  requestId: string
  merchantIdHash: `0x${string}`
  startDate: string
  endDate: string
}

interface ReadyResponse {
  records: ReadyRecord[]
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
    if (reasonCodes.has(decoded)) {
      return decoded as ComplianceReportPeriod['reasonCode']
    }
    return 'UNKNOWN'
  } catch {
    return 'UNKNOWN'
  }
}

const withinDateWindow = (periodStart: bigint, periodEnd: bigint, startDate: string, endDate: string): boolean => {
  const startSec = BigInt(Math.floor(Date.parse(`${startDate}T00:00:00.000Z`) / 1000))
  const endSec = BigInt(Math.floor(Date.parse(`${endDate}T23:59:59.999Z`) / 1000))
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

const filterPeriodRecordedLogs = (
  runtime: Runtime<Config>,
  evmClient: EVMClient,
  fromBlock: bigint,
  toBlock: bigint,
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

  let cursor = fromBlock
  while (cursor <= toBlock) {
    const chunkToBlock = cursor + (MAX_FILTER_LOG_RANGE_BLOCKS - 1n)
    const chunkEnd = chunkToBlock < toBlock ? chunkToBlock : toBlock

    const response = evmClient
      .filterLogs(runtime, {
        filterQuery: {
          fromBlock: toValuesBigIntJson(cursor),
          toBlock: toValuesBigIntJson(chunkEnd),
          addresses: [hexToBase64(runtime.config.revenueRegistryAddress)],
          topics: [{ topic: [hexToBase64(PERIOD_RECORDED_TOPIC0)] }],
        },
      })
      .result()

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
  const fromBlock = runtime.config.revenueRegistryDeployBlock
  const toBlock = latestBlock > fromBlock ? latestBlock : fromBlock

  const logs = filterPeriodRecordedLogs(runtime, evmClient, fromBlock, toBlock)

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

  const payloadForHash = {
    generatedAt: runtime.now().toISOString(),
    merchantIdHash: record.merchantIdHash.toLowerCase(),
    startDate: record.startDate,
    endDate: record.endDate,
    chainSelectorName: runtime.config.chainSelectorName,
    revenueRegistryAddress: runtime.config.revenueRegistryAddress,
    scanFromBlock: fromBlock.toString(),
    scanToBlock: toBlock.toString(),
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

  const reportHash = keccak256(stringToHex(JSON.stringify(payloadForHash)))

  return {
    ...payloadForHash,
    reportHash,
  }
}

const onCronTrigger = (runtime: Runtime<Config>, _payload: CronPayload): string => {
  const backendToken =
    runtime.config.backendInternalToken?.trim() ||
    getSecretValue(runtime, 'BACKEND_INTERNAL_TOKEN')

  const ready = sendJson<ReadyResponse>(runtime, {
    url: `${runtime.config.backendBaseUrl}${runtime.config.readyPath}?limit=${runtime.config.maxBatch}`,
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${backendToken}`,
    },
  })

  if (!ready.records || ready.records.length === 0) {
    runtime.log('No pending compliance report requests')
    return JSON.stringify({ processed: 0, requested: 0 })
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
  let processed = 0
  let failed = 0

  for (const record of ready.records) {
    try {
      const report = buildReportForRecord(runtime, evmClient, record)

      sendJson(runtime, {
        url: `${runtime.config.backendBaseUrl}${runtime.config.resultPath}`,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${backendToken}`,
        },
        body: {
          requestId: record.requestId,
          outcome: 'SUCCESS',
          report,
        },
      })

      runtime.log(
        `Compliance report generated for ${record.requestId}: periods=${report.totals.periodCount}, hash=${report.reportHash}`,
      )
      processed += 1
    } catch (error) {
      failed += 1
      const errorMessage = error instanceof Error ? error.message : String(error)
      runtime.log(`Compliance report failed for ${record.requestId}: ${errorMessage}`)

      sendJson(runtime, {
        url: `${runtime.config.backendBaseUrl}${runtime.config.resultPath}`,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${backendToken}`,
        },
        body: {
          requestId: record.requestId,
          outcome: 'RETRYABLE',
          errorCode: 'WORKFLOW_EXCEPTION',
          errorMessage,
        },
      })
    }
  }

  return JSON.stringify({
    processed,
    failed,
    requested: ready.records.length,
  })
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
