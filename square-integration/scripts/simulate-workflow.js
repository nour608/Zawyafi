import { Client, Environment } from 'square';
import { keccak256, toHex } from 'viem';
import https from 'https';

const client = new Client({
  accessToken: 'EAAAl_N-zhyC69107ortxf2yJQMpZQFJZpVajsA2ygbu-wvgzVuOpUteJ1AahzaO',
  environment: Environment.Sandbox
});

const LOCATION_ID = 'LN4XVJJ78W496';

async function fetchSquareTransactions(date) {
  const startTime = new Date(date);
  startTime.setUTCHours(0, 0, 0, 0);
  
  const endTime = new Date(date);
  endTime.setUTCHours(23, 59, 59, 999);

  console.log(`\n📅 Fetching transactions for: ${date.toISOString().split('T')[0]}`);
  console.log(`   Time range: ${startTime.toISOString()} to ${endTime.toISOString()}\n`);

  const url = `/v2/payments?location_id=${LOCATION_ID}&begin_time=${encodeURIComponent(startTime.toISOString())}&end_time=${encodeURIComponent(endTime.toISOString())}`;
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'connect.squareupsandbox.com',
      path: url,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer EAAAl_N-zhyC69107ortxf2yJQMpZQFJZpVajsA2ygbu-wvgzVuOpUteJ1AahzaO',
        'Content-Type': 'application/json',
        'Square-Version': '2024-03-20'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.payments) {
          resolve(json.payments.filter(p => p.status === 'COMPLETED'));
        } else {
          resolve([]);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function aggregateAndHash(transactions, dateTimestamp) {
  let totalGross = 0n;
  let totalTax = 0n;
  let refunds = 0n;
  const txIds = [];

  console.log('📊 Transaction Details:\n');
  
  for (const tx of transactions) {
    const amount = BigInt(tx.amount_money?.amount || 0);
    const tax = BigInt(tx.total_tax_money?.amount || 0);
    const refund = BigInt(tx.refunded_money?.amount || 0);
    
    totalGross += amount;
    totalTax += tax;
    refunds += refund;
    txIds.push(tx.id);

    console.log(`   ${tx.id}`);
    console.log(`   Amount: $${(Number(amount) / 100).toFixed(2)} | Tax: $${(Number(tax) / 100).toFixed(2)} | Note: ${tx.note || 'N/A'}`);
    console.log();
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
    transactionIds: txIds
  };
}

async function runWorkflow() {
  console.log('🚀 Starting Square-Chainlink Workflow Simulation\n');
  console.log('=' .repeat(60));

  // Use today's date to capture the sales we just created
  const today = new Date();
  const dateTimestamp = BigInt(Math.floor(today.setUTCHours(0, 0, 0, 0) / 1000));

  const transactions = await fetchSquareTransactions(today);

  if (transactions.length === 0) {
    console.log('❌ No transactions found for this date');
    return;
  }

  console.log(`✅ Found ${transactions.length} completed transactions\n`);
  console.log('=' .repeat(60));

  const salesData = aggregateAndHash(transactions, dateTimestamp);

  console.log('=' .repeat(60));
  console.log('\n💰 Aggregated Sales Data:\n');
  console.log(`   Date (Unix):     ${salesData.date}`);
  console.log(`   Total Gross:     $${(Number(salesData.totalGross) / 100).toFixed(2)} (${salesData.totalGross} cents)`);
  console.log(`   Total Tax:       $${(Number(salesData.totalTax) / 100).toFixed(2)} (${salesData.totalTax} cents)`);
  console.log(`   Refunds:         $${(Number(salesData.refunds) / 100).toFixed(2)} (${salesData.refunds} cents)`);
  console.log(`   Total Net:       $${(Number(salesData.totalNet) / 100).toFixed(2)} (${salesData.totalNet} cents)`);
  console.log(`   Transaction Cnt: ${salesData.txCount}`);
  console.log(`   Data Hash:       ${salesData.dataHash}`);

  console.log('\n🔐 Transaction IDs included in hash:');
  salesData.transactionIds.forEach(id => console.log(`   - ${id}`));

  console.log('\n=' .repeat(60));
  console.log('\n✅ Workflow simulation complete!');
  console.log('\n📝 This data would be ABI-encoded and submitted to blockchain via CRE');
  console.log('   The smart contract would store this immutable record on-chain.');
}

runWorkflow().catch(console.error);
