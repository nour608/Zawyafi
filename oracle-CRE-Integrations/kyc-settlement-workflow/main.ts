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
  TxStatus,
  type CronPayload,
  type HTTPSendRequester,
  type Runtime,
} from '@chainlink/cre-sdk'
import { encodeAbiParameters, keccak256, parseAbiParameters, stringToBytes } from 'viem'
import { z } from 'zod'

const configSchema = z.object({
  schedule: z.string(),
  // CRE simulation runtime can reject zod URL validation even for valid URLs.
  backendBaseUrl: z.string().min(1),
  backendInternalToken: z.string().optional(),
  readyOnchainPath: z.string(),
  onchainResultPath: z.string(),
  chainSelectorName: z.string(),
  isTestnet: z.boolean(),
  kycReceiverAddress: z.string(),
  gasLimit: z.string(),
  maxBatch: z.coerce.number().int().positive(),
})

type Config = z.infer<typeof configSchema>

const reportParams = parseAbiParameters('bytes32 requestIdHash, address wallet, uint64 approvedAt')

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

interface ReadyRecord {
  requestId: string
  wallet: `0x${string}`
  approvedAt: string
}

interface ReadyResponse {
  records: ReadyRecord[]
}

const parseApprovedAt = (approvedAt: string, runtime: Runtime<Config>): bigint => {
  const parsedMs = Date.parse(approvedAt)
  if (!Number.isFinite(parsedMs)) {
    return BigInt(Math.floor(runtime.now().getTime() / 1_000))
  }

  return BigInt(Math.floor(parsedMs / 1_000))
}

const onCronTrigger = (runtime: Runtime<Config>, _payload: CronPayload): string => {
  const backendToken =
    runtime.config.backendInternalToken?.trim() ||
    getSecretValue(runtime, 'BACKEND_INTERNAL_TOKEN')

  const ready = sendJson<ReadyResponse>(runtime, {
    url: `${runtime.config.backendBaseUrl}${runtime.config.readyOnchainPath}?limit=${runtime.config.maxBatch}`,
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${backendToken}`,
    },
  })

  if (!ready.records || ready.records.length === 0) {
    runtime.log('No approved KYC records ready for settlement')
    return JSON.stringify({ processed: 0 })
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

  for (const record of ready.records) {
    const requestIdHash = keccak256(stringToBytes(record.requestId))
    const approvedAt = parseApprovedAt(record.approvedAt, runtime)

    try {
      const encodedPayload = encodeAbiParameters(reportParams, [requestIdHash, record.wallet, approvedAt])
      const report = runtime
        .report({
          encodedPayload: hexToBase64(encodedPayload),
          encoderName: 'evm',
          signingAlgo: 'ecdsa',
          hashingAlgo: 'keccak256',
        })
        .result()

      const writeResponse = evmClient
        .writeReport(runtime, {
          receiver: runtime.config.kycReceiverAddress,
          report,
          gasConfig: {
            gasLimit: runtime.config.gasLimit,
          },
        })
        .result()

      if (writeResponse.txStatus !== TxStatus.SUCCESS) {
        sendJson(runtime, {
          url: `${runtime.config.backendBaseUrl}${runtime.config.onchainResultPath}`,
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${backendToken}`,
          },
          body: {
            requestId: record.requestId,
            outcome: 'RETRYABLE',
            errorCode: 'EVM_WRITE_FAILED',
            errorMessage: writeResponse.errorMessage || String(writeResponse.txStatus),
          },
        })
        continue
      }

      const txHash = bytesToHex(writeResponse.txHash || new Uint8Array(32))

      sendJson(runtime, {
        url: `${runtime.config.backendBaseUrl}${runtime.config.onchainResultPath}`,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${backendToken}`,
        },
        body: {
          requestId: record.requestId,
          txHash,
          outcome: 'SUCCESS',
        },
      })

      processed += 1
      runtime.log(`KYC settlement success for ${record.requestId}: ${txHash}`)
    } catch (error) {
      sendJson(runtime, {
        url: `${runtime.config.backendBaseUrl}${runtime.config.onchainResultPath}`,
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
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      })
    }
  }

  return JSON.stringify({
    processed,
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
