'use client'

import { useMemo, useState } from 'react'
import { sepolia } from 'thirdweb/chains'
import { useSendTransaction, useWaitForReceipt } from 'thirdweb/react'
import type { TxLifecycleState } from '@/lib/types/frontend'
import { thirdwebClient } from '@/lib/web3/client'

const EMPTY_TX_HASH = `0x${'0'.repeat(64)}` as const

export const useTransactionAction = () => {
  const [localError, setLocalError] = useState<string | null>(null)

  const { mutateAsync: sendTransactionAsync, isPending: isSigning, data: sentTx, reset: resetSendTx } = useSendTransaction()
  const transactionHash = sentTx?.transactionHash as `0x${string}` | undefined
  const receipt = useWaitForReceipt({
    client: thirdwebClient,
    chain: sepolia,
    transactionHash: transactionHash ?? EMPTY_TX_HASH,
  })

  const state: TxLifecycleState = useMemo(() => {
    if (isSigning) return 'signing'
    if (localError) return 'failed'
    if (!transactionHash) return 'idle'
    if (receipt.isLoading) return 'pending'
    if (receipt.isError) return 'failed'
    if (receipt.isSuccess) return 'confirmed'
    return 'idle'
  }, [isSigning, localError, receipt.isError, receipt.isLoading, receipt.isSuccess, transactionHash])

  const receiptError = receipt.error instanceof Error ? receipt.error.message : null
  const error = localError ?? (transactionHash ? receiptError : null)

  const run = async (
    transaction: Parameters<typeof sendTransactionAsync>[0],
  ): Promise<`0x${string}` | null> => {
    setLocalError(null)

    try {
      const result = await sendTransactionAsync(transaction)
      return result.transactionHash as `0x${string}`
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit transaction'
      setLocalError(message)
      return null
    }
  }

  const reset = (): void => {
    resetSendTx()
    setLocalError(null)
  }

  return {
    state,
    transactionHash,
    receipt,
    error,
    run,
    reset,
  }
}
