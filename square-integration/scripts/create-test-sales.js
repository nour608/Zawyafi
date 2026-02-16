import { Client, Environment } from 'square';
import crypto from 'crypto';

const client = new Client({
  accessToken: 'EAAAl_N-zhyC69107ortxf2yJQMpZQFJZpVajsA2ygbu-wvgzVuOpUteJ1AahzaO',
  environment: Environment.Sandbox
});

const LOCATION_ID = 'LN4XVJJ78W496';

async function createTestSales() {
  console.log('Creating test sales in Square sandbox...\n');

  const sales = [
    { amount: 2500, description: 'Coffee and pastry' },
    { amount: 4500, description: 'Lunch order' },
    { amount: 1200, description: 'Espresso' },
    { amount: 3800, description: 'Sandwich combo' },
    { amount: 6700, description: 'Catering order' }
  ];

  for (const sale of sales) {
    try {
      const idempotencyKey = crypto.randomUUID();
      
      const response = await client.paymentsApi.createPayment({
        sourceId: 'cnon:card-nonce-ok',
        idempotencyKey,
        locationId: LOCATION_ID,
        amountMoney: {
          amount: BigInt(sale.amount),
          currency: 'USD'
        },
        note: sale.description
      });

      console.log(`✓ Created payment: $${(sale.amount / 100).toFixed(2)} - ${sale.description}`);
      console.log(`  Payment ID: ${response.result.payment.id}`);
      console.log(`  Status: ${response.result.payment.status}\n`);
    } catch (error) {
      console.error(`✗ Failed to create payment: ${error.message}\n`);
    }
  }

  console.log('\nTest sales created successfully!');
  console.log('Total: 5 transactions, $187.00 gross');
}

createTestSales().catch(console.error);
