'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { prepareContractCall } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { keccak256, stringToBytes, isAddress } from 'viem'
import { CapabilityGate } from '@/components/shared/capability-gate'
import { TxStatus } from '@/components/shared/tx-status'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useTransactionAction } from '@/features/transactions/use-transaction-action'
import { useCapabilities } from '@/hooks/use-capabilities'
import { contracts } from '@/lib/web3/contracts'

const merchantId = 'merchant-1'

const isWholePositive = (value: string): boolean => /^\d+$/.test(value) && value !== '0'

export const MerchantActionsPanel = () => {
  const account = useActiveAccount()
  const address = account?.address
  const { capabilities, isConnected } = useCapabilities()

  const [createTokenName, setCreateTokenName] = useState('Zawyafi Unit Token')
  const [createTokenSymbol, setCreateTokenSymbol] = useState('ZUT')
  const [createPurchaseToken, setCreatePurchaseToken] = useState('0x0000000000000000000000000000000000000000')
  const [createUnitCostMinor, setCreateUnitCostMinor] = useState('2000000')
  const [createUnitPayoutMinor, setCreateUnitPayoutMinor] = useState('2200000')
  const [createUnitsForSale, setCreateUnitsForSale] = useState('1000')
  const [createProductId, setCreateProductId] = useState('Coffee')

  const [fundBatchId, setFundBatchId] = useState('1')
  const [fundAmountMinor, setFundAmountMinor] = useState('100000000')

  const [withdrawBatchId, setWithdrawBatchId] = useState('1')
  const [withdrawAmountMinor, setWithdrawAmountMinor] = useState('1000000')
  const [withdrawTo, setWithdrawTo] = useState('')

  const createAction = useTransactionAction()
  const fundAction = useTransactionAction()
  const withdrawAction = useTransactionAction()

  const canTransact = capabilities.canUseMerchant && isConnected && Boolean(address)

  const createInvalid =
    !isAddress(createPurchaseToken as `0x${string}`) ||
    !isWholePositive(createUnitCostMinor) ||
    !isWholePositive(createUnitPayoutMinor) ||
    !isWholePositive(createUnitsForSale)

  const fundInvalid = !isWholePositive(fundBatchId) || !isWholePositive(fundAmountMinor)
  const withdrawInvalid = !isWholePositive(withdrawBatchId) || !isWholePositive(withdrawAmountMinor) || !isAddress(withdrawTo)

  const handleCreateBatch = async (): Promise<void> => {
    if (!address || createInvalid) {
      return
    }

    const hash = await createAction.run(
      prepareContractCall({
        contract: contracts.factory,
        method:
          'function createBatch(bytes32 merchantIdHash, bytes32 productIdHash, address purchaseToken, uint256 unitCostMinor, uint256 unitPayoutMinor, uint256 unitsForSale, string tokenName, string tokenSymbol, address merchantTreasury, address complianceTreasury)',
        params: [
          keccak256(stringToBytes(merchantId)),
          keccak256(stringToBytes(createProductId)),
          createPurchaseToken as `0x${string}`,
          BigInt(createUnitCostMinor),
          BigInt(createUnitPayoutMinor),
          BigInt(createUnitsForSale),
          createTokenName,
          createTokenSymbol,
          address,
          address,
        ],
      }),
    )

    if (hash) {
      toast.success('Batch creation submitted')
    }
  }

  const handleFundBatch = async (): Promise<void> => {
    if (fundInvalid) {
      return
    }

    const hash = await fundAction.run(
      prepareContractCall({
        contract: contracts.settlementVault,
        method: 'function fundBatch(uint256 batchId, uint256 amountMinor)',
        params: [BigInt(fundBatchId), BigInt(fundAmountMinor)],
      }),
    )

    if (hash) {
      toast.success('Fund batch transaction submitted')
    }
  }

  const handleWithdrawProceeds = async (): Promise<void> => {
    if (withdrawInvalid) {
      return
    }

    const hash = await withdrawAction.run(
      prepareContractCall({
        contract: contracts.factory,
        method: 'function withdrawProceeds(uint256 batchId, uint256 amountMinor, address to)',
        params: [BigInt(withdrawBatchId), BigInt(withdrawAmountMinor), withdrawTo as `0x${string}`],
      }),
    )

    if (hash) {
      toast.success('Withdraw transaction submitted')
    }
  }

  return (
    <CapabilityGate
      enabled={canTransact}
      blockedLabel="Connect an allowed merchant/admin wallet to execute create, fund, and withdraw transactions."
    >
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="space-y-3">
          <h3 className="font-heading text-base font-semibold">Create Batch</h3>
          <Input aria-label="Product id" value={createProductId} onChange={(event) => setCreateProductId(event.target.value)} placeholder="Product slug" />
          <Input aria-label="Token name" value={createTokenName} onChange={(event) => setCreateTokenName(event.target.value)} placeholder="Token name" />
          <Input aria-label="Token symbol" value={createTokenSymbol} onChange={(event) => setCreateTokenSymbol(event.target.value)} placeholder="Symbol" />
          <Input aria-label="Purchase token" value={createPurchaseToken} onChange={(event) => setCreatePurchaseToken(event.target.value)} placeholder="0x purchase token" />
          <Input aria-label="Unit cost minor" value={createUnitCostMinor} onChange={(event) => setCreateUnitCostMinor(event.target.value)} placeholder="Minor units" />
          <Input aria-label="Unit payout minor" value={createUnitPayoutMinor} onChange={(event) => setCreateUnitPayoutMinor(event.target.value)} placeholder="Minor units" />
          <Input aria-label="Units for sale" value={createUnitsForSale} onChange={(event) => setCreateUnitsForSale(event.target.value)} placeholder="Units" />
          {createInvalid ? <p className="text-xs text-warning">Provide valid numeric values and a valid purchase token address.</p> : null}
          <Button onClick={handleCreateBatch} disabled={createInvalid}>Create Batch</Button>
          <TxStatus state={createAction.state} hash={createAction.transactionHash} error={createAction.error} />
        </Card>

        <Card className="space-y-3">
          <h3 className="font-heading text-base font-semibold">Fund Batch</h3>
          <Input aria-label="Fund batch id" value={fundBatchId} onChange={(event) => setFundBatchId(event.target.value)} placeholder="Batch ID" />
          <Input aria-label="Fund amount minor" value={fundAmountMinor} onChange={(event) => setFundAmountMinor(event.target.value)} placeholder="Amount in token minor units" />
          {fundInvalid ? <p className="text-xs text-warning">Batch id and amount must be positive whole numbers.</p> : null}
          <Button onClick={handleFundBatch} disabled={fundInvalid}>Fund Batch</Button>
          <p className="text-xs text-textMuted">Requires pre-approved purchase token allowance for SettlementVault.</p>
          <TxStatus state={fundAction.state} hash={fundAction.transactionHash} error={fundAction.error} />
        </Card>

        <Card className="space-y-3">
          <h3 className="font-heading text-base font-semibold">Withdraw Proceeds</h3>
          <Input aria-label="Withdraw batch id" value={withdrawBatchId} onChange={(event) => setWithdrawBatchId(event.target.value)} placeholder="Batch ID" />
          <Input aria-label="Withdraw amount" value={withdrawAmountMinor} onChange={(event) => setWithdrawAmountMinor(event.target.value)} placeholder="Amount in token minor units" />
          <Input aria-label="Withdraw recipient" value={withdrawTo} onChange={(event) => setWithdrawTo(event.target.value)} placeholder="Recipient address" />
          {withdrawInvalid ? <p className="text-xs text-warning">Use positive batch/amount values and a valid recipient wallet.</p> : null}
          <Button variant="secondary" onClick={handleWithdrawProceeds} disabled={withdrawInvalid}>Withdraw</Button>
          <TxStatus state={withdrawAction.state} hash={withdrawAction.transactionHash} error={withdrawAction.error} />
        </Card>
      </div>
    </CapabilityGate>
  )
}
