'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { prepareContractCall } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { TxStatus } from '@/components/shared/tx-status'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useTransactionAction } from '@/features/transactions/use-transaction-action'
import type { BatchView } from '@/lib/types/frontend'
import { contracts } from '@/lib/web3/contracts'

const parsePositiveInt = (value: string): bigint | null => {
  if (!/^\d+$/.test(value) || value === '0') {
    return null
  }

  return BigInt(value)
}

type InvestorTransactionsPanelProps = {
  batches: BatchView[]
}

export const InvestorTransactionsPanel = ({ batches }: InvestorTransactionsPanelProps) => {
  const account = useActiveAccount()
  const isConnected = Boolean(account?.address)

  const [buyBatchId, setBuyBatchId] = useState(() => String(batches[0]?.batchId ?? 1))
  const [buyUnits, setBuyUnits] = useState('1')
  const [claimBatchId, setClaimBatchId] = useState(() => String(batches[0]?.batchId ?? 1))
  const [claimUnits, setClaimUnits] = useState('1')

  const buyAction = useTransactionAction()
  const claimAction = useTransactionAction()

  const buyUnitsValue = parsePositiveInt(buyUnits)
  const claimUnitsValue = parsePositiveInt(claimUnits)
  const buyValidation = buyUnitsValue ? null : 'Enter a positive whole number of units.'
  const claimValidation = claimUnitsValue ? null : 'Enter a positive whole number of units.'

  const batchOptions = useMemo(() => batches.map((batch) => String(batch.batchId)), [batches])

  const handleBuyUnits = async (): Promise<void> => {
    if (!buyUnitsValue) {
      return
    }

    const hash = await buyAction.run(
      prepareContractCall({
        contract: contracts.factory,
        method: 'function buyUnits(uint256 batchId, uint256 units)',
        params: [BigInt(buyBatchId), buyUnitsValue],
      }),
    )

    if (hash) {
      toast.success('Buy units transaction submitted')
    }
  }

  const handleClaimUnits = async (): Promise<void> => {
    if (!claimUnitsValue) {
      return
    }

    const hash = await claimAction.run(
      prepareContractCall({
        contract: contracts.settlementVault,
        method: 'function claim(uint256 batchId, uint256 units)',
        params: [BigInt(claimBatchId), claimUnitsValue],
      }),
    )

    if (hash) {
      toast.success('Claim transaction submitted')
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="space-y-3">
        <h3 className="font-heading text-base font-semibold">Buy Units</h3>
        <Select value={buyBatchId} onChange={(event) => setBuyBatchId(event.target.value)}>
          {batchOptions.map((batchId) => (
            <option key={batchId} value={batchId}>
              Batch #{batchId}
            </option>
          ))}
        </Select>
        <Input aria-label="Units to buy" value={buyUnits} onChange={(event) => setBuyUnits(event.target.value)} placeholder="Units" />
        {buyValidation ? <p className="text-xs text-warning">{buyValidation}</p> : null}
        <Button onClick={handleBuyUnits} disabled={!isConnected || Boolean(buyValidation)}>
          Buy Units
        </Button>
        <p className="text-xs text-textMuted">Requires purchase token approval to ProductBatchFactory for the selected batch.</p>
        <TxStatus state={buyAction.state} hash={buyAction.transactionHash} error={buyAction.error} />
      </Card>

      <Card className="space-y-3">
        <h3 className="font-heading text-base font-semibold">Claim Payout</h3>
        <Select value={claimBatchId} onChange={(event) => setClaimBatchId(event.target.value)}>
          {batchOptions.map((batchId) => (
            <option key={batchId} value={batchId}>
              Batch #{batchId}
            </option>
          ))}
        </Select>
        <Input aria-label="Units to claim" value={claimUnits} onChange={(event) => setClaimUnits(event.target.value)} placeholder="Units" />
        {claimValidation ? <p className="text-xs text-warning">{claimValidation}</p> : null}
        <Button onClick={handleClaimUnits} variant="secondary" disabled={!isConnected || Boolean(claimValidation)}>
          Claim
        </Button>
        <TxStatus state={claimAction.state} hash={claimAction.transactionHash} error={claimAction.error} />
      </Card>
    </div>
  )
}
