'use client'

import { useActiveAccount } from 'thirdweb/react'
import { Card } from '@/components/ui/card'
import { DataState } from '@/components/ui/data-state'
import { usePortfolio } from '@/lib/api/hooks'
import { formatShortHash, formatUnits, formatUsdMinor } from '@/lib/utils/format'

export const InvestorPortfolioPanel = () => {
  const account = useActiveAccount()
  const address = account?.address
  const isConnected = Boolean(address)

  const portfolioQuery = usePortfolio(address)

  return (
    <Card>
      <h2 className="font-heading text-lg font-semibold">Portfolio Snapshot</h2>
      {!isConnected ? <p className="mt-3 text-sm text-warning">Connect your wallet to load positions and claimables.</p> : null}
      <DataState
        isLoading={portfolioQuery.isLoading}
        error={portfolioQuery.error instanceof Error ? portfolioQuery.error.message : null}
        empty={isConnected && Boolean(address) && (portfolioQuery.data?.positions.length ?? 0) === 0}
        emptyLabel="No positions found for this wallet yet."
      >
        {portfolioQuery.data ? (
          <>
            <p className="mt-3 text-xs text-textMuted">Wallet: {formatShortHash(portfolioQuery.data.wallet)}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {portfolioQuery.data.positions.map((position) => (
                <Card key={`${position.batchId}-${position.unitToken}`} className="bg-panelMuted">
                  <p className="font-semibold text-text">
                    Batch #{position.batchId} · {position.symbol}
                  </p>
                  <p className="mt-2 text-sm text-textMuted">Owned: {formatUnits(position.unitsOwned)}</p>
                  <p className="text-sm text-textMuted">Claimable now: {formatUnits(position.unitsClaimableNow)}</p>
                  <p className="text-sm text-textMuted">Cost basis: {formatUsdMinor(position.costBasisMinor)}</p>
                </Card>
              ))}
            </div>
          </>
        ) : null}
      </DataState>
    </Card>
  )
}
