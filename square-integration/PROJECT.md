
You are a senior Web3 backend engineer and blockchain architect.

Design and implement a production-ready integration between the **Square API** and the **Chainlink Runtime Environment (CRE)**.

The goal is:

* Fetch all daily sales transactions from Square at the end of each business day.
* Aggregate them (total revenue, total tax, total refunds, number of transactions).
* Push a cryptographically verifiable summary of the day's sales onto a blockchain using Chainlink.

---

### Functional Requirements

1. **Data Collection**

   * Use Square Payments API to:

     * Fetch all transactions for a given location.
     * Filter by a specific date range (00:00–23:59 UTC).
   * Handle pagination.
   * Exclude failed/canceled payments.
2. **Aggregation Logic**

   * Compute:

     * Total gross sales
     * Net revenue
     * Total tax
     * Refund amounts
     * Number of successful transactions
   * Generate a SHA-256 hash of:

     * The ordered transaction IDs
     * Timestamp
     * Aggregated totals
3. **On-Chain Publishing**

   * Deploy a Solidity smart contract with:

     * `recordDailySales(date, totalGross, totalNet, totalTax, refunds, txCount, dataHash)`
     * Emit an event `DailySalesRecorded`
   * Use Chainlink Runtime Environment to:

     * Trigger an off-chain computation job at 23:59 UTC
     * Fetch aggregated data
     * Submit a transaction to the smart contract
4. **Automation**

   * Schedule execution once per day.
   * Ensure idempotency (prevent duplicate submission for the same date).
5. **Security**

   * Secure Square API credentials.
   * Use environment variables.
   * Sign blockchain transactions securely.
   * Protect against replay attacks.

---

### Non-Functional Requirements

* Written in Node.js or Kotlin (backend service).
* Include retry logic and error handling.
* Include logging and observability.
* Gas-optimized smart contract.
* Production deployment architecture (Docker + CI/CD).

---

### Deliverables

1. Architecture diagram explanation.
2. Smart contract Solidity code.
3. Backend service code.
4. Chainlink job specification.
5. Deployment steps.
6. Security considerations.
7. Cost estimation (gas + infrastructure).

---

Assume deployment on Ethereum-compatible network (e.g., Sepolia for testing).

Provide full working code examples and explanations.

---


