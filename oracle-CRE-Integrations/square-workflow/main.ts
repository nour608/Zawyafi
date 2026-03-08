import {
    bytesToHex,
    ConfidentialHTTPClient,
    CronCapability,
    EVMClient,
    consensusIdenticalAggregation,
    getNetwork,
    handler,
    hexToBase64,
    HTTPClient,
    Runner,
    type CronPayload,
    type NodeRuntime,
    type Runtime,
    TxStatus,
} from "@chainlink/cre-sdk";
import {
    decodeFunctionResult,
    encodeAbiParameters,
    encodeFunctionData,
    keccak256,
    parseAbi,
    parseAbiParameters,
    stringToBytes,
    stringToHex,
} from "viem";
import { z } from "zod";

const VERIFIED_STATUS = 1;
const UNVERIFIED_STATUS = 0;
const REASON_OK = stringToHex("OK", { size: 32 });
const REASON_REFUND_RATIO = stringToHex("REFUND_RATIO", { size: 32 });
const REASON_SUDDEN_SPIKE = stringToHex("SUDDEN_SPIKE", { size: 32 });
const REASON_REFUND_AND_SPIKE = stringToHex("REFUND_AND_SPIKE", { size: 32 });

const coordinatorReadAbi = parseAbi([
    "function settlementVault() view returns (address)",
    "function revenueRegistry() view returns (address)",
]);
const settlementVaultReadAbi = parseAbi([
    "function isBatchFinished(uint256 batchId) view returns (bool)",
    "function factory() view returns (address)",
]);
const factoryReadAbi = parseAbi([
    "function getBatchCategoryHashes(uint256 batchId) view returns (bytes32[])",
]);

const revenueRegistryReadAbi = parseAbi([
    "function isPeriodRecorded(bytes32 periodId) view returns (bool)",
]);

const configSchema = z.object({
    schedule: z.string().describe("Cron schedule for the workflow"),
    squareBaseUrl: z.string().describe("Square API Base URL"),
    squareVersion: z.string().describe("Square API Version"),
    locationId: z.string().describe("Square Location ID"),
    merchantId: z.string().describe("Merchant ID for Square"),
    batchId: z.coerce
        .bigint()
        .describe("Batch ID associated with this revenue"),
    oracleCoordinatorAddress: z
        .string()
        .describe("Address of the OracleCoordinator contract"),
    chainSelectorName: z
        .string()
        .describe("Chain selector name for the target network"),
    isTestnet: z.boolean().describe("Whether target chain is testnet"),
    gasLimit: z.string().describe("Gas limit for the transaction"),
    anomalyRefundRatioBpsThreshold: z
        .number()
        .int()
        .min(1)
        .max(10_000)
        .describe(
            "Refund ratio threshold in basis points to mark period as anomalous",
        ),
    anomalyNetSalesSpikeCentsThreshold: z.coerce
        .bigint()
        .describe(
            "Absolute net-sales threshold in cents to mark period as sudden-spike anomaly",
        ),
    minEventCountForWrite: z.coerce
        .number()
        .int()
        .positive()
        .describe("Minimum matched events required before writing"),
    skipWrite: z
        .boolean()
        .describe("If true, run fetch+consensus only and skip onchain write"),
});

type Config = z.infer<typeof configSchema>;

interface SquarePayment {
    id: string;
    status: string;
    note?: string;
    amount_money?: {
        amount: number;
        currency: string;
    };
}

interface SquareRefund {
    id: string;
    status: string;
    payment_id?: string;
    amount_money?: {
        amount: number;
        currency: string;
    };
}

type SquarePaymentsPage = {
    payments?: SquarePayment[];
    cursor?: string;
};

type SquareRefundsPage = {
    refunds?: SquareRefund[];
    cursor?: string;
};

interface QueryWindow {
    beginIso: string;
    endIso: string;
    periodStartSec: number;
    periodEndSec: number;
    generatedAtSec: number;
}

interface PeriodReport {
    periodId: `0x${string}`;
    merchantIdHash: `0x${string}`;
    productIdHash: `0x${string}`;
    periodStart: bigint;
    periodEnd: bigint;
    grossSales: bigint;
    refunds: bigint;
    netSales: bigint;
    unitsSold: bigint;
    refundUnits: bigint;
    netUnitsSold: bigint;
    eventCount: bigint;
    batchHash: `0x${string}`;
    generatedAt: bigint;
    status: number;
    riskScore: number;
    reasonCode: `0x${string}`;
}

type ReportLogView = {
    periodId: string;
    merchantIdHash: string;
    productIdHash: string;
    periodStart: string;
    periodEnd: string;
    grossSales: string;
    refunds: string;
    netSales: string;
    unitsSold: string;
    refundUnits: string;
    netUnitsSold: string;
    eventCount: string;
    batchHash: string;
    generatedAt: string;
    status: number;
    riskScore: number;
    reasonCode: string;
};

interface CategoryMetricsSnapshot {
    categoryName: string;
    categoryHash: `0x${string}`;
    grossSales: string;
    refunds: string;
    unitsSold: string;
    refundUnits: string;
    eventCount: string;
}

interface AggregatedSquareSnapshot {
    paymentsTotal: number;
    paymentsCompleted: number;
    refundsTotal: number;
    refundsCompleted: number;
    categories: CategoryMetricsSnapshot[];
}

const periodReportAndBatchParams = parseAbiParameters(
    "(bytes32 periodId, bytes32 merchantIdHash, bytes32 productIdHash, uint64 periodStart, uint64 periodEnd, uint256 grossSales, uint256 refunds, uint256 netSales, uint256 unitsSold, uint256 refundUnits, uint256 netUnitsSold, uint256 eventCount, bytes32 batchHash, uint64 generatedAt, uint8 status, uint16 riskScore, bytes32 reasonCode) report, uint256 batchId",
);

const inferCategoryFromNote = (note?: string): string | undefined => {
    if (!note) return undefined;
    const slashIndex = note.lastIndexOf("/");
    const dashIndex = note.lastIndexOf(" - ");
    if (slashIndex <= 0 || dashIndex < 0 || slashIndex <= dashIndex + 3)
        return undefined;
    return note.slice(dashIndex + 3, slashIndex).trim();
};

const decodeJsonBody = <T>(body: Uint8Array): T => {
    const text = new TextDecoder().decode(body);
    return JSON.parse(text) as T;
};

const buildSquareUrl = (
    baseUrl: string,
    endpoint: string,
    query: Record<string, string | undefined>,
): string => {
    const normalizedBase = baseUrl.endsWith("/")
        ? baseUrl.slice(0, -1)
        : baseUrl;
    const normalizedEndpoint = endpoint.startsWith("/")
        ? endpoint
        : `/${endpoint}`;
    const queryParts: string[] = [];

    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
            queryParts.push(
                `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
            );
        }
    }

    if (queryParts.length === 0) {
        return `${normalizedBase}${normalizedEndpoint}`;
    }

    return `${normalizedBase}${normalizedEndpoint}?${queryParts.join("&")}`;
};

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
                method: "GET",
                url,
                headers: {
                    Authorization: `Bearer ${squareToken}`,
                    "Square-Version": config.squareVersion,
                    Accept: "application/json",
                },
            })
            .result();

        if (response.statusCode !== 200) {
            const bodyText = new TextDecoder().decode(response.body);
            throw new Error(
                `Square API request failed with status ${response.statusCode}: ${bodyText}`,
            );
        }

        return decodeJsonBody<T>(response.body);
    }

    const confidentialHttpClient = new ConfidentialHTTPClient();
    let lastError: unknown;
    for (const namespace of ["main", ""]) {
        try {
            const response = confidentialHttpClient
                .sendRequest(nodeRuntime, {
                    request: {
                        method: "GET",
                        url,
                        multiHeaders: {
                            Authorization: {
                                values: ["Bearer {{.SQUARE_PAT}}"],
                            },
                            "Square-Version": {
                                values: [config.squareVersion],
                            },
                            Accept: { values: ["application/json"] },
                        },
                    },
                    vaultDonSecrets: [
                        {
                            key: "SQUARE_PAT",
                            namespace,
                        },
                    ],
                })
                .result();

            if (response.statusCode !== 200) {
                const bodyText = new TextDecoder().decode(response.body);
                throw new Error(
                    `Square API request failed with status ${response.statusCode}: ${bodyText}`,
                );
            }

            return decodeJsonBody<T>(response.body);
        } catch (err) {
            lastError = err;
        }
    }

    throw new Error(
        `Square API confidential request failed: ${String(lastError)}`,
    );
};

const fetchSquarePayments = (
    nodeRuntime: NodeRuntime<Config>,
    httpClient: HTTPClient,
    config: Config,
    window: QueryWindow,
    squareToken?: string,
): SquarePayment[] => {
    const payments: SquarePayment[] = [];
    let cursor: string | undefined;

    do {
        const url = buildSquareUrl(config.squareBaseUrl, "/v2/payments", {
            begin_time: window.beginIso,
            end_time: window.endIso,
            location_id: config.locationId,
            sort_order: "ASC",
            cursor,
        });
        const page = sendSquareGet<SquarePaymentsPage>(
            nodeRuntime,
            httpClient,
            config,
            url,
            squareToken,
        );
        payments.push(...(page.payments ?? []));
        cursor = page.cursor;
    } while (cursor);

    return payments;
};

const fetchSquareRefunds = (
    nodeRuntime: NodeRuntime<Config>,
    httpClient: HTTPClient,
    config: Config,
    window: QueryWindow,
    squareToken?: string,
): SquareRefund[] => {
    const refunds: SquareRefund[] = [];
    let cursor: string | undefined;

    do {
        const url = buildSquareUrl(config.squareBaseUrl, "/v2/refunds", {
            begin_time: window.beginIso,
            end_time: window.endIso,
            location_id: config.locationId,
            sort_order: "ASC",
            cursor,
        });
        const page = sendSquareGet<SquareRefundsPage>(
            nodeRuntime,
            httpClient,
            config,
            url,
            squareToken,
        );
        refunds.push(...(page.refunds ?? []));
        cursor = page.cursor;
    } while (cursor);

    return refunds;
};

const fetchSquareSnapshot = (
    nodeRuntime: NodeRuntime<Config>,
    window: QueryWindow,
    squareToken?: string,
): string => {
    const config = nodeRuntime.config;
    const httpClient = new HTTPClient();
    const payments = fetchSquarePayments(
        nodeRuntime,
        httpClient,
        config,
        window,
        squareToken,
    );
    const refunds = fetchSquareRefunds(
        nodeRuntime,
        httpClient,
        config,
        window,
        squareToken,
    );

    let completedPayments = 0;
    let completedRefunds = 0;

    const paymentToCategoryHash = new Map<string, `0x${string}`>();
    const categoryStats = new Map<
        `0x${string}`,
        {
            categoryName: string;
            grossSales: bigint;
            unitsSold: bigint;
            refundAmount: bigint;
            matchedRefundEvents: bigint;
            selectedPaymentIds: Set<string>;
            refundedPaymentIds: Set<string>;
        }
    >();

    for (const payment of payments) {
        if (payment.status !== "COMPLETED") continue;
        completedPayments += 1;

        const categoryName = inferCategoryFromNote(payment.note);
        if (!categoryName || categoryName.length === 0) continue;

        const categoryHash = keccak256(stringToBytes(categoryName));
        if (!categoryStats.has(categoryHash)) {
            categoryStats.set(categoryHash, {
                categoryName,
                grossSales: 0n,
                unitsSold: 0n,
                refundAmount: 0n,
                matchedRefundEvents: 0n,
                selectedPaymentIds: new Set<string>(),
                refundedPaymentIds: new Set<string>(),
            });
        }

        const category = categoryStats.get(categoryHash)!;
        category.grossSales += BigInt(payment.amount_money?.amount ?? 0);
        category.unitsSold += 1n;
        category.selectedPaymentIds.add(payment.id);
        paymentToCategoryHash.set(payment.id, categoryHash);
    }

    for (const refund of refunds) {
        if (refund.status !== "COMPLETED") continue;
        completedRefunds += 1;

        if (!refund.payment_id) continue;
        const categoryHash = paymentToCategoryHash.get(refund.payment_id);
        if (!categoryHash) continue;

        const category = categoryStats.get(categoryHash);
        if (!category) continue;

        category.refundAmount += BigInt(refund.amount_money?.amount ?? 0);
        category.refundedPaymentIds.add(refund.payment_id);
        category.matchedRefundEvents += 1n;
    }

    const categories = Array.from(categoryStats.entries())
        .map(([categoryHash, category]) => ({
            categoryHash,
            categoryName: category.categoryName,
            grossSales: category.grossSales.toString(),
            refunds: category.refundAmount.toString(),
            unitsSold: category.unitsSold.toString(),
            refundUnits: BigInt(category.refundedPaymentIds.size).toString(),
            eventCount: (
                BigInt(category.selectedPaymentIds.size) +
                category.matchedRefundEvents
            ).toString(),
        }))
        .sort((a, b) => a.categoryHash.localeCompare(b.categoryHash));

    nodeRuntime.log(
        `Square snapshot built: payments_total=${payments.length}, payments_completed=${completedPayments}, refunds_total=${refunds.length}, refunds_completed=${completedRefunds}, categories=${categories.length}`,
    );

    return JSON.stringify({
        paymentsTotal: payments.length,
        paymentsCompleted: completedPayments,
        refundsTotal: refunds.length,
        refundsCompleted: completedRefunds,
        categories,
    } satisfies AggregatedSquareSnapshot);
};

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
});

const submitReport = (
    runtime: Runtime<Config>,
    report: PeriodReport,
): string => {
    const network = getNetwork({
        chainFamily: "evm",
        chainSelectorName: runtime.config.chainSelectorName,
        isTestnet: runtime.config.isTestnet,
    });

    if (!network) {
        throw new Error(
            `Network not found for chain selector name: ${runtime.config.chainSelectorName}`,
        );
    }

    const encodedReport = encodeAbiParameters(periodReportAndBatchParams, [
        report,
        runtime.config.batchId,
    ]);
    const reportResponse = runtime
        .report({
            encodedPayload: hexToBase64(encodedReport),
            encoderName: "evm",
            signingAlgo: "ecdsa",
            hashingAlgo: "keccak256",
        })
        .result();

    const evmClient = new EVMClient(network.chainSelector.selector);
    const writeResponse = evmClient
        .writeReport(runtime, {
            receiver: runtime.config.oracleCoordinatorAddress,
            report: reportResponse,
            gasConfig: {
                gasLimit: runtime.config.gasLimit,
            },
        })
        .result();

    if (writeResponse.txStatus !== TxStatus.SUCCESS) {
        throw new Error(
            `Transaction failed: ${writeResponse.errorMessage || writeResponse.txStatus}`,
        );
    }

    const txHash = bytesToHex(writeResponse.txHash || new Uint8Array(32));
    runtime.log(`Transaction submitted: ${txHash}`);
    return txHash;
};

const getScheduledDate = (
    runtime: Runtime<Config>,
    payload: CronPayload,
): Date => {
    const rawTimestamp = payload.scheduledExecutionTime as
        | {
              seconds?: bigint | number;
              nanos?: number;
          }
        | undefined;

    if (!rawTimestamp?.seconds) {
        return runtime.now();
    }

    const seconds =
        typeof rawTimestamp.seconds === "bigint"
            ? Number(rawTimestamp.seconds)
            : rawTimestamp.seconds;
    const nanos = rawTimestamp.nanos ?? 0;

    if (!Number.isFinite(seconds)) {
        return runtime.now();
    }

    return new Date(seconds * 1000 + nanos / 1_000_000);
};

// UTC time
const getPreviousUtcDayWindow = (referenceDate: Date): QueryWindow => {
    const year = referenceDate.getUTCFullYear();
    const month = referenceDate.getUTCMonth();
    const day = referenceDate.getUTCDate();

    const start = new Date(Date.UTC(year, month, day - 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, day - 1, 23, 59, 59, 999));
    const periodStartSec = Math.floor(start.getTime() / 1000);
    const periodEndSec = Math.floor(end.getTime() / 1000);
    const generatedAtSec = Math.max(
        Math.floor(referenceDate.getTime() / 1000),
        periodEndSec,
    );

    return {
        beginIso: start.toISOString(),
        endIso: end.toISOString(),
        periodStartSec,
        periodEndSec,
        generatedAtSec,
    };
};

// EET time
const getPreviousEetDayWindow = (referenceDate: Date): QueryWindow => {
    const eetReferenceDate = new Date(
        referenceDate.getTime() + 2 * 60 * 60 * 1000,
    );

    const year = eetReferenceDate.getUTCFullYear();
    const month = eetReferenceDate.getUTCMonth();
    const day = eetReferenceDate.getUTCDate();

    const startUtc = new Date(Date.UTC(year, month, day - 1, -2, 0, 0, 0));
    const endUtc = new Date(Date.UTC(year, month, day - 1, 21, 59, 59, 999));

    const periodStartSec = Math.floor(startUtc.getTime() / 1000);
    const periodEndSec = Math.floor(endUtc.getTime() / 1000);
    const generatedAtSec = Math.max(
        Math.floor(referenceDate.getTime() / 1000),
        periodEndSec,
    );

    return {
        beginIso: startUtc.toISOString(),
        endIso: endUtc.toISOString(),
        periodStartSec,
        periodEndSec,
        generatedAtSec,
    };
};

const readContract = <T>(
    runtime: Runtime<Config>,
    evmClient: EVMClient,
    to: `0x${string}`,
    abi: ReturnType<typeof parseAbi>,
    functionName: string,
    args: unknown[] = [],
): T => {
    const callData = encodeFunctionData({
        abi,
        functionName,
        args,
    });

    const callResult = evmClient
        .callContract(runtime, {
            call: {
                from: hexToBase64("0x0000000000000000000000000000000000000000"),
                to: hexToBase64(to),
                data: hexToBase64(callData),
            },
        })
        .result();

    return decodeFunctionResult({
        abi,
        functionName,
        data: bytesToHex(callResult.data),
    }) as T;
};

const buildReportsForTokenizedCategories = (
    runtime: Runtime<Config>,
    window: QueryWindow,
    tokenizedCategoryHashes: `0x${string}`[],
    snapshot: AggregatedSquareSnapshot,
): PeriodReport[] => {
    const metricsMap = new Map<string, CategoryMetricsSnapshot>();
    for (const metric of snapshot.categories) {
        metricsMap.set(metric.categoryHash.toLowerCase(), metric);
    }

    const merchantIdHash = keccak256(stringToBytes(runtime.config.merchantId));
    const periodStart = BigInt(window.periodStartSec);
    const periodEnd = BigInt(window.periodEndSec);
    const batchHash = keccak256(
        encodeAbiParameters(parseAbiParameters("uint256"), [
            runtime.config.batchId,
        ]),
    );
    const minEventCount = BigInt(runtime.config.minEventCountForWrite);

    const reports: PeriodReport[] = [];
    for (const categoryHash of tokenizedCategoryHashes) {
        const metric = metricsMap.get(categoryHash.toLowerCase());
        if (!metric) {
            continue;
        }

        const grossSales = BigInt(metric.grossSales);
        const refunds = BigInt(metric.refunds);
        const unitsSold = BigInt(metric.unitsSold);
        const refundUnits = BigInt(metric.refundUnits);
        const eventCount = BigInt(metric.eventCount);
        if (eventCount < minEventCount) {
            continue;
        }

        if (refunds > grossSales) {
            throw new Error(
                `Refunds exceed gross sales for category ${categoryHash}`,
            );
        }

        const netSales = grossSales - refunds;
        const netUnitsSold = unitsSold - refundUnits;

        const refundRatioBps =
            grossSales > 0n ? Number((refunds * 10_000n) / grossSales) : 0;
        const refundRatioFlagged =
            refundRatioBps >= runtime.config.anomalyRefundRatioBpsThreshold;
        const suddenSpikeFlagged =
            netSales >= runtime.config.anomalyNetSalesSpikeCentsThreshold;
        const flagged = refundRatioFlagged || suddenSpikeFlagged;
        const status = flagged ? UNVERIFIED_STATUS : VERIFIED_STATUS;

        let riskScore = 0;
        if (refundRatioFlagged) {
            riskScore += Math.min(
                700,
                Math.max(250, Math.floor(refundRatioBps / 10)),
            );
        }
        if (suddenSpikeFlagged) {
            riskScore += 350;
        }
        riskScore = Math.min(riskScore, 1000);

        let reasonCode = REASON_OK;
        if (refundRatioFlagged && suddenSpikeFlagged) {
            reasonCode = REASON_REFUND_AND_SPIKE;
        } else if (refundRatioFlagged) {
            reasonCode = REASON_REFUND_RATIO;
        } else if (suddenSpikeFlagged) {
            reasonCode = REASON_SUDDEN_SPIKE;
        }

        const periodId = keccak256(
            encodeAbiParameters(
                parseAbiParameters("bytes32, bytes32, uint64, uint64"),
                [merchantIdHash, categoryHash, periodStart, periodEnd],
            ),
        );

        reports.push({
            periodId,
            merchantIdHash,
            productIdHash: categoryHash,
            periodStart,
            periodEnd,
            grossSales,
            refunds,
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
        });
    }

    return reports;
};

const onCronTrigger = (
    runtime: Runtime<Config>,
    payload: CronPayload,
): string => {
    const scheduledDate = getScheduledDate(runtime, payload);
    // change this to UTC time if you want getPreviousUtcDayWindow
    const window = getPreviousEetDayWindow(scheduledDate);

    const network = getNetwork({
        chainFamily: "evm",
        chainSelectorName: runtime.config.chainSelectorName,
        isTestnet: runtime.config.isTestnet,
    });
    if (!network) {
        throw new Error(
            `Network not found for chain selector name: ${runtime.config.chainSelectorName}`,
        );
    }
    const evmClient = new EVMClient(network.chainSelector.selector);

    const settlementVaultAddress = readContract<`0x${string}`>(
        runtime,
        evmClient,
        runtime.config.oracleCoordinatorAddress as `0x${string}`,
        coordinatorReadAbi,
        "settlementVault",
        [],
    );
    const revenueRegistryAddress = readContract<`0x${string}`>(
        runtime,
        evmClient,
        runtime.config.oracleCoordinatorAddress as `0x${string}`,
        coordinatorReadAbi,
        "revenueRegistry",
        [],
    );
    const batchFinished = readContract<boolean>(
        runtime,
        evmClient,
        settlementVaultAddress,
        settlementVaultReadAbi,
        "isBatchFinished",
        [runtime.config.batchId],
    );
    if (batchFinished) {
        runtime.log(
            `Batch ${runtime.config.batchId.toString()} is finished, skipping Square fetch/write`,
        );
        return JSON.stringify({
            skippedWrite: true,
            reason: "BATCH_FINISHED",
            batchId: runtime.config.batchId.toString(),
        });
    }

    const factoryAddress = readContract<`0x${string}`>(
        runtime,
        evmClient,
        settlementVaultAddress,
        settlementVaultReadAbi,
        "factory",
        [],
    );
    const tokenizedCategoryHashes = readContract<`0x${string}`[]>(
        runtime,
        evmClient,
        factoryAddress,
        factoryReadAbi,
        "getBatchCategoryHashes",
        [runtime.config.batchId],
    );
    if (!tokenizedCategoryHashes || tokenizedCategoryHashes.length === 0) {
        runtime.log(
            `No tokenized categories for batch ${runtime.config.batchId.toString()}, skipping`,
        );
        return JSON.stringify({
            skippedWrite: true,
            reason: "NO_TOKENIZED_CATEGORIES",
            batchId: runtime.config.batchId.toString(),
        });
    }

    let squareToken: string | undefined;
    try {
        squareToken = runtime
            .getSecret({ id: "SQUARE_PAT", namespace: "main" })
            .result().value;
    } catch {
        try {
            squareToken = runtime
                .getSecret({ id: "SQUARE_PAT" })
                .result().value;
        } catch {
            squareToken = undefined;
            runtime.log(
                "runtime.getSecret for SQUARE_PAT failed; using confidential-http secret injection fallback",
            );
        }
    }

    runtime.log(
        `Fetching Square data from ${window.beginIso} to ${window.endIso} for batch ${runtime.config.batchId.toString()}`,
    );

    const snapshotRaw = runtime
        .runInNodeMode(
            fetchSquareSnapshot,
            consensusIdenticalAggregation<string>(),
        )(window, squareToken)
        .result();
    const snapshot = JSON.parse(snapshotRaw) as AggregatedSquareSnapshot;

    const reports = buildReportsForTokenizedCategories(
        runtime,
        window,
        tokenizedCategoryHashes,
        snapshot,
    );
    runtime.log(
        `Built ${reports.length} report(s) from ${snapshot.categories.length} detected category bucket(s), tokenizedCategories=${tokenizedCategoryHashes.length}`,
    );

    if (reports.length === 0) {
        return JSON.stringify({
            skippedWrite: true,
            reason: "NO_ACTIVITY_FOR_TOKENIZED_CATEGORIES",
            batchId: runtime.config.batchId.toString(),
        });
    }

    runtime.log(
        `CRE aggregated reports: ${JSON.stringify(reports.map((report) => toReportLogView(report)))}`,
    );

    if (runtime.config.skipWrite) {
        runtime.log("skipWrite=true, not sending reports onchain");
        return JSON.stringify({
            skippedWrite: true,
            batchId: runtime.config.batchId.toString(),
            reports: reports.map((report) => toReportLogView(report)),
        });
    }

    const txHashes: string[] = [];
    let skippedAlreadyRecorded = 0;

    for (const report of reports) {
        const isRecorded = readContract<boolean>(
            runtime,
            evmClient,
            revenueRegistryAddress,
            revenueRegistryReadAbi,
            "isPeriodRecorded",
            [report.periodId],
        );

        if (isRecorded) {
            runtime.log(
                `Period ${report.periodId} (batch ${runtime.config.batchId.toString()}) already recorded, skipping`,
            );
            skippedAlreadyRecorded++;
            continue;
        }

        txHashes.push(submitReport(runtime, report));
    }

    return JSON.stringify({
        skippedWrite: txHashes.length === 0 && reports.length > 0,
        batchId: runtime.config.batchId.toString(),
        reportsSent: txHashes.length,
        reportsSkippedAlreadyRecorded: skippedAlreadyRecorded,
        txHashes,
    });
};

export async function main() {
    const runner = await Runner.newRunner<Config>({
        configSchema,
    });

    await runner.run((config) => {
        const cron = new CronCapability();
        return [
            handler(
                cron.trigger({
                    schedule: config.schedule,
                }),
                onCronTrigger,
            ),
        ];
    });
}
