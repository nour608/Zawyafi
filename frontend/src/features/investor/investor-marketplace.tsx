'use client'

import Link from 'next/link'
import { ImageIcon, LogOut, Search, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { useActiveAccount, useActiveWallet, useDisconnect } from 'thirdweb/react'
import { clearWalletAuthSession } from '@/lib/api/wallet-auth'
import { formatShortHash } from '@/lib/utils/format'
import { InvestorConnectGate } from '@/components/shared/investor-connect-gate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useChainBatches, type EnrichedBatch } from '@/lib/web3/use-chain-batches'

// ─── Batch Card ────────────────────────────────────────────────────────────

const BatchCard = ({ batch }: { batch: EnrichedBatch }) => {
  const { onChain, categories, meta } = batch
  const id = onChain.id.toString()

  const progress =
    onChain.totalUnitsForSale > 0n
      ? Number((onChain.totalUnitsSold * 100n) / onChain.totalUnitsForSale)
      : 0

  const minUnitCost =
    categories.length > 0
      ? categories.reduce((min, c) => (c.unitCost < min ? c.unitCost : min), categories[0].unitCost)
      : 0n

  const minCostUsdc = minUnitCost > 0n ? Number(formatUnits(minUnitCost, 6)).toFixed(0) : '—'

  const tone = onChain.closed ? 'warning' : onChain.active ? 'success' : 'signal'
  const statusLabel = onChain.closed ? 'Closed' : onChain.active ? 'Live' : 'Paused'

  return (
    <Card className="group flex flex-col gap-4 transition-shadow hover:shadow-[0_0_20px_rgba(26,138,125,0.12)]">
      {/* Image */}
      <div className="relative h-40 overflow-hidden rounded-lg bg-panelMuted">
        {meta?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={meta.imageUrl} alt={meta.title ?? `Batch #${id}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-textMuted">
            <ImageIcon className="size-10 opacity-30" />
          </div>
        )}
        <div className="absolute right-2 top-2">
          <Badge tone={tone} label={statusLabel} />
        </div>
      </div>

      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-gold">{meta?.sector ?? 'Tokenized Batch'}</p>
        <h3 className="mt-1 font-heading text-lg font-semibold text-text">
          {meta?.title ?? `Batch #${id}`}
        </h3>
        {meta?.description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-textMuted">{meta.description}</p>
        )}
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-textMuted">
          <span>Funding progress</span>
          <span className="font-semibold text-text">{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-panelMuted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal to-teal/70 transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-textMuted">
          <span>{onChain.totalUnitsSold.toString()} units sold</span>
          <span>of {onChain.totalUnitsForSale.toString()}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-line bg-panelMuted p-2.5">
          <p className="text-xs uppercase tracking-wide text-textMuted">Min Ticket</p>
          <p className="mt-0.5 text-sm font-semibold text-text">${minCostUsdc} USDC</p>
        </div>
        <div className="rounded-lg border border-line bg-panelMuted p-2.5">
          <p className="text-xs uppercase tracking-wide text-textMuted">Profit</p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-success">
            <TrendingUp className="size-3.5" />
            {(onChain.profitBps / 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* CTA */}
      <Link href={`/investor/deal/${id}`} className="mt-auto">
        <Button variant="secondary" className="w-full">
          View Deal →
        </Button>
      </Link>
    </Card>
  )
}

// ─── Marketplace ──────────────────────────────────────────────────────────

const STATUS_FILTERS = ['ALL', 'LIVE', 'PAUSED', 'CLOSED'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

export const InvestorMarketplace = () => {
  const { batches, isLoading, error } = useChainBatches()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [search, setSearch] = useState('')
  const account = useActiveAccount()
  const wallet = useActiveWallet()
  const { disconnect } = useDisconnect()

  const handleDisconnect = () => {
    if (!wallet) return
    clearWalletAuthSession()
    disconnect(wallet)
  }

  const filtered = useMemo(() => {
    return batches.filter((b) => {
      if (statusFilter === 'LIVE' && (!b.onChain.active || b.onChain.closed)) return false
      if (statusFilter === 'PAUSED' && (b.onChain.active || b.onChain.closed)) return false
      if (statusFilter === 'CLOSED' && !b.onChain.closed) return false
      if (search) {
        const q = search.toLowerCase()
        const inTitle = b.meta?.title?.toLowerCase().includes(q) ?? false
        const inSector = b.meta?.sector?.toLowerCase().includes(q) ?? false
        const inId = b.onChain.id.toString().includes(q)
        if (!inTitle && !inSector && !inId) return false
      }
      return true
    })
  }, [batches, statusFilter, search])

  return (
    <InvestorConnectGate
      title="Connect to browse the marketplace"
      description="Investment opportunities are visible after wallet login."
    >
      <main className="space-y-6">
        {/* Hero header — matches production */}
        <div className="rounded-xl border border-line bg-panel/60 p-5">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-textMuted">Investor Marketplace</p>
            {account?.address && (
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs font-mono text-textMuted">{formatShortHash(account.address, 6, 4)}</span>
                <button
                  onClick={handleDisconnect}
                  aria-label="Disconnect wallet"
                  title="Disconnect"
                  className="rounded p-1 text-textMuted transition-colors hover:bg-panelMuted hover:text-text"
                >
                  <LogOut className="size-3.5" />
                </button>
              </div>
            )}
          </div>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-text md:text-4xl">
            Discover Live{' '}
            <em className="not-italic text-gold">Tokenized</em>
            <br />
            <em className="italic text-gold">Opportunities</em>
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-textMuted">
            Browse real product batches, evaluate risk tiers, and move directly into deal actions with wallet-ready flows.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border border-line">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 text-xs uppercase tracking-wider transition-colors ${statusFilter === f
                  ? 'bg-teal/20 text-teal'
                  : 'text-textMuted hover:text-text'
                  }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-textMuted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or sector..."
              className="pl-8"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            Failed to load batches: {error}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl border border-line bg-panelMuted" />
            ))}
          </div>
        )}

        {/* No batches */}
        {!isLoading && !error && batches.length === 0 && (
          <div className="rounded-xl border border-dashed border-line bg-panelMuted/50 py-16 text-center text-textMuted">
            <p className="font-semibold">No investment listings yet</p>
            <p className="mt-1 text-sm">An admin will create the first batch soon.</p>
          </div>
        )}

        {/* No results after filter */}
        {!isLoading && !error && batches.length > 0 && filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-textMuted">No batches match your filter.</p>
        )}

        {/* Grid */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((b) => (
              <BatchCard key={b.onChain.id.toString()} batch={b} />
            ))}
          </div>
        )}
      </main>
    </InvestorConnectGate>
  )
}
