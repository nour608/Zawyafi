import {
  CronCapability,
  EVMClient,
  HTTPClient,
  getNetwork,
  hexToBase64,
  bytesToHex,
  TxStatus,
  type Runtime,
  Runner,
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, parseAbiParameters, keccak256, toHex } from "viem";
import { z } from "zod";

const configSchema = z.object({
  schedule: z.string(),
  chainSelectorName: z.string(),
  consumerAddress: z.string(),
  gasLimit: z.string(),
  squareAccessToken: z.string(),
  squareLocationId: z.string(),
  squareEnvironment: z.string(),
});

type Config = z.infer<typeof configSchema>;

interface SquarePayment {
  id: string;
  status: string;
  amount_money?: { amount: number };
  total_tax_money?: { amount: number };
  refunded_money?: { amount: number };
}

interface DailySalesData {
  date: bigint;
  totalGross: bigint;
  totalNet: bigint;
  totalTax: bigint;
  refunds: bigint;
  txCount: bigint;
  dataHash: string;
}

async function fetchSquareTransactions(
  runtime: Runtime<Config>,
  date: Date
): Promise<SquarePayment[]> {
  const httpClient = new HTTPClient();
  
  const startTime = new Date(date);
  startTime.setUTCHours(0, 0, 0, 0);
  
  const endTime = new Date(date);
  endTime.setUTCHours(23, 59, 59, 999);

  const baseUrl = runtime.config.squareEnvironment === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

  const transactions: SquarePayment[] = [];
  let cursor: string | undefined;

  do {
    const url = `${baseUrl}/v2/payments?location_id=${runtime.config.squareLocationId}&begin_time=${startTime.toISOString()}&end_time=${endTime.toISOString()}${cursor ? `&cursor=${cursor}` : ""}`;

    const response = httpClient.get(runtime, {
      url,
      headers: {
        Authorization: `Bearer ${runtime.config.squareAccessToken}`,
        "Content-Type": "application/json",
      },
    }).result();

    const data = JSON.parse(response.body);
    
    if (data.payments) {
      const completed = data.payments.filter((p: SquarePayment) => p.status === "COMPLETED");
      transactions.push(...completed);
    }

    cursor = data.cursor;
  } while (cursor);

  runtime.log(`Fetched ${transactions.length} transactions`);
  return transactions;
}

function aggregateAndHash(transactions: SquarePayment[], dateTimestamp: bigint): DailySalesData {
  let totalGross = 0n;
  let totalTax = 0n;
  let refunds = 0n;
  const txIds: string[] = [];

  for (const tx of transactions) {
    totalGross += BigInt(tx.amount_money?.amount || 0);
    totalTax += BigInt(tx.total_tax_money?.amount || 0);
    refunds += BigInt(tx.refunded_money?.amount || 0);
    txIds.push(tx.id);
  }

  const totalNet = totalGross - totalTax - refunds;

  const hashData = JSON.stringify({
    transactionIds: txIds.sort(),
    timestamp: dateTimestamp.toString(),
    totalGross: totalGross.toString(),
    totalNet: totalNet.toString(),
    totalTax: totalTax.toString(),
    refunds: refunds.toString(),
  });

  const dataHash = keccak256(toHex(hashData));

  return {
    date: dateTimestamp,
    totalGross,
    totalNet,
    totalTax,
    refunds,
    txCount: BigInt(transactions.length),
    dataHash,
  };
}

const processDailySales = async (runtime: Runtime<Config>) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateTimestamp = BigInt(Math.floor(yesterday.setUTCHours(0, 0, 0, 0) / 1000));

  runtime.log(`Processing sales for ${yesterday.toISOString().split("T")[0]}`);

  const transactions = await fetchSquareTransactions(runtime, yesterday);

  if (transactions.length === 0) {
    runtime.log("No transactions found");
    return "No transactions";
  }

  const salesData = aggregateAndHash(transactions, dateTimestamp);

  runtime.log(`Aggregated: ${salesData.txCount} txs, Gross: ${salesData.totalGross}, Net: ${salesData.totalNet}`);

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: runtime.config.chainSelectorName,
    isTestnet: true,
  });

  if (!network) {
    throw new Error(`Network not found: ${runtime.config.chainSelectorName}`);
  }

  const evmClient = new EVMClient(network.chainSelector.selector);

  const reportData = encodeAbiParameters(
    parseAbiParameters("uint256, uint256, uint256, uint256, uint256, uint256, bytes32"),
    [
      salesData.date,
      salesData.totalGross,
      salesData.totalNet,
      salesData.totalTax,
      salesData.refunds,
      salesData.txCount,
      salesData.dataHash as `0x${string}`,
    ]
  );

  const reportResponse = runtime.report({
    encodedPayload: hexToBase64(reportData),
    encoderName: "evm",
    signingAlgo: "ecdsa",
    hashingAlgo: "keccak256",
  }).result();

  const writeResult = evmClient.writeReport(runtime, {
    receiver: runtime.config.consumerAddress,
    report: reportResponse,
    gasConfig: {
      gasLimit: runtime.config.gasLimit,
    },
  }).result();

  if (writeResult.txStatus === TxStatus.SUCCESS) {
    const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32));
    runtime.log(`Transaction successful: ${txHash}`);
    return txHash;
  }

  throw new Error(`Transaction failed: ${writeResult.txStatus}`);
};

const initWorkflow = (config: Config) => {
  const cron = new CronCapability();
  return [
    cron.handler(
      cron.trigger({
        schedule: config.schedule,
      }),
      processDailySales
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
