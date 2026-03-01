'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import { DataState } from '@/components/ui/data-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBatches } from '@/lib/api/hooks'
import type { BatchView, MarketplaceCardView, MarketplaceFilter } from '@/lib/types/frontend'
import { formatUnits, formatUsdMinor } from '@/lib/utils/format'

const WalletActionButton = dynamic(
  () => import('@/components/shared/wallet-action-button').then((module) => module.WalletActionButton),
  { ssr: false },
)

const FILTERS: MarketplaceFilter[] = ['ALL', 'LIVE', 'PAUSED', 'LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK']

export const mapBatchToMarketplaceCard = (batch: BatchView): MarketplaceCardView => {
  const unitsForSale = BigInt(batch.unitsForSale)
  const sold = BigInt(batch.unitsSoldToInvestors)
  const available = unitsForSale > sold ? unitsForSale - sold : 0n
  const soldPercent = unitsForSale > 0n ? Number((sold * 10_000n) / unitsForSale) / 100 : 0

  return {
    batchId: batch.batchId,
    title: `Batch #${batch.batchId}`,
    symbol: batch.tokenSymbol,
    riskTier: batch.riskTier,
    active: batch.active,
    soldPercent,
    unitCostMinor: batch.unitCostMinor,
    unitPayoutMinor: batch.unitPayoutMinor,
    availableUnits: available.toString(),
    fundingLiquidityMinor: batch.fundingLiquidityMinor,
  }
}

export const filterMarketplaceCards = (
  cards: MarketplaceCardView[],
  filter: MarketplaceFilter,
  searchQuery: string,
): MarketplaceCardView[] => {
  const term = searchQuery.trim().toLowerCase()

  return cards.filter((card) => {
    const matchesFilter =
      filter === 'ALL'
        ? true
        : filter === 'LIVE'
          ? card.active
          : filter === 'PAUSED'
            ? !card.active
            : filter === 'LOW_RISK'
              ? card.riskTier === 'LOW'
              : filter === 'MEDIUM_RISK'
                ? card.riskTier === 'MEDIUM'
                : card.riskTier === 'HIGH'

    const matchesSearch =
      term.length === 0 ||
      card.symbol.toLowerCase().includes(term) ||
      String(card.batchId).includes(term) ||
      card.title.toLowerCase().includes(term)

    return matchesFilter && matchesSearch
  })
}

export const InvestorMarketplace = () => {
  const [filter, setFilter] = useState<MarketplaceFilter>('ALL')
  const [search, setSearch] = useState('')

  const batchesQuery = useBatches()

  const cards = useMemo(() => {
    return (batchesQuery.data?.batches ?? []).map(mapBatchToMarketplaceCard)
  }, [batchesQuery.data?.batches])

  const filteredCards = useMemo(() => filterMarketplaceCards(cards, filter, search), [cards, filter, search])

  return (
    <main className="space-y-6">
      <section className="cc-card overflow-hidden p-7 md:p-10">
        <p className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-teal">Investor Marketplace</p>
        <h1 className="max-w-3xl font-display text-4xl leading-tight text-text md:text-5xl">
          Discover Live <span className="italic text-gold">Tokenized Opportunities</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-textMuted md:text-base">
          Browse real product batches, evaluate risk tiers, and move directly into deal actions with wallet-ready flows.
        </p>
        <div className="mt-6">
          <WalletActionButton labelDisconnected="Connect" variant="cc" />
        </div>
      </section>

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => {
              const active = item === filter
              return (
                <button
                  key={item}
                  className={active ? 'cc-tag border-gold text-gold' : 'cc-tag'}
                  onClick={() => setFilter(item)}
                  type="button"
                >
                  {item.replace('_', ' ')}
                </button>
              )
            })}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-textMuted" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              placeholder="Search by symbol or batch id"
            />
          </div>
        </div>
      </Card>

      <DataState
        isLoading={batchesQuery.isLoading}
        error={batchesQuery.error instanceof Error ? batchesQuery.error.message : null}
        empty={filteredCards.length === 0}
        emptyLabel="No marketplace listings found for the selected filter."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCards.map((card) => (
            <Card key={card.batchId} className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-text">{card.title}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-textMuted">{card.symbol}</p>
                </div>
                <Badge tone={card.active ? 'success' : 'warning'} label={card.active ? 'Live' : 'Paused'} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm text-textMuted">
                <div>
                  <p className="text-xs uppercase tracking-[0.1em]">Unit Cost</p>
                  <p className="mt-1 font-semibold text-text">{formatUsdMinor(card.unitCostMinor)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.1em]">Unit Payout</p>
                  <p className="mt-1 font-semibold text-text">{formatUsdMinor(card.unitPayoutMinor)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.1em]">Available</p>
                  <p className="mt-1 font-semibold text-text">{formatUnits(card.availableUnits)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.1em]">Liquidity</p>
                  <p className="mt-1 font-semibold text-text">{formatUsdMinor(card.fundingLiquidityMinor)}</p>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-textMuted">
                  <span>Sold</span>
                  <span>{card.soldPercent.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-panelMuted">
                  <div className="h-full rounded-full bg-signal" style={{ width: `${Math.min(100, card.soldPercent)}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Badge
                  tone={card.riskTier === 'LOW' ? 'success' : card.riskTier === 'MEDIUM' ? 'warning' : 'danger'}
                  label={`${card.riskTier} Risk`}
                />
                <Link href={`/investor/deal/${card.batchId}`}>
                  <Button variant="secondary" className="px-4">
                    View Deal <ArrowRight className="ml-2 size-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </DataState>
    </main>
  )
}
