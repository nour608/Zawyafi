'use client'

import Link from 'next/link'
import {
    ArrowLeft,
    CheckCircle2,
    ImageIcon,
    Loader2,
    MapPin,
    ShieldAlert,
    TrendingUp,
} from 'lucide-react'
import { useParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { getContract, prepareContractCall } from 'thirdweb'
import { useActiveAccount, useReadContract } from 'thirdweb/react'
import { formatUnits } from 'viem'
import { TxStatus } from '@/components/shared/tx-status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useTransactionAction } from '@/features/transactions/use-transaction-action'
import { useChainBatch, type CategoryState } from '@/lib/web3/use-chain-batches'
import { thirdwebClient } from '@/lib/web3/client'
import { sepolia } from 'thirdweb/chains'
import { erc20Abi } from '@/lib/web3/abis'
import { contracts } from '@/lib/web3/contracts'

const USDC_DECIMALS = 6

const fmt = (val: bigint, decimals = USDC_DECIMALS) =>
    Number(formatUnits(val, decimals)).toLocaleString('en-US', { maximumFractionDigits: 2 })

// ─── Category Buy Card ─────────────────────────────────────────────────────

const CategoryBuyCard = ({
    batchId,
    category,
    purchaseToken,
    onSuccess,
}: {
    batchId: bigint
    category: CategoryState
    purchaseToken: string
    onSuccess: () => void
}) => {
    const account = useActiveAccount()
    const [units, setUnits] = useState('1')
    const approveAction = useTransactionAction()
    const buyAction = useTransactionAction()

    const unitsNum = Math.max(1, parseInt(units, 10) || 1)
    const costTotal = category.unitCost * BigInt(unitsNum)
    const remaining = category.unitsForSale - category.unitsSold

    const tokenContract = useMemo(
        () =>
            getContract({
                client: thirdwebClient,
                chain: sepolia,
                address: purchaseToken as `0x${string}`,
                abi: erc20Abi,
            }),
        [purchaseToken],
    )

    const allowanceQuery = useReadContract({
        contract: tokenContract,
        method: 'allowance',
        params: account?.address
            ? [account.address as `0x${string}`, contracts.factory.address as `0x${string}`]
            : ['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000'],
        queryOptions: { enabled: !!account?.address },
    })

    const currentAllowance = (allowanceQuery.data as bigint | undefined) ?? 0n
    const needsApproval = currentAllowance < costTotal

    const handleApprove = async () => {
        await approveAction.run(
            prepareContractCall({
                contract: tokenContract,
                method: 'approve',
                params: [contracts.factory.address as `0x${string}`, costTotal],
            }),
        )
        await allowanceQuery.refetch()
    }

    const handleBuy = async () => {
        const hash = await buyAction.run(
            prepareContractCall({
                contract: contracts.factory,
                method:
                    'function buyUnits(uint256 batchId, bytes32 categoryIdHash, uint256 units) nonpayable',
                params: [batchId, category.categoryIdHash as `0x${string}`, BigInt(unitsNum)],
            }),
        )
        if (hash) {
            onSuccess()
        }
    }

    const isSoldOut = remaining === 0n
    const clampedMax = Math.min(unitsNum, Number(remaining))

    return (
        <div className="rounded-xl border border-line bg-panelMuted p-4">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs uppercase tracking-wide text-textMuted">Category</p>
                    <p className="mt-0.5 font-mono text-xs text-text break-all">{category.categoryIdHash.slice(0, 18)}…</p>
                </div>
                <Badge
                    tone={isSoldOut ? 'warning' : 'success'}
                    label={isSoldOut ? 'Sold Out' : 'Available'}
                />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                    <p className="text-xs text-textMuted">Unit Cost</p>
                    <p className="font-semibold text-text">${fmt(category.unitCost)} USDC</p>
                </div>
                <div>
                    <p className="text-xs text-textMuted">Available</p>
                    <p className="font-semibold text-text">{remaining.toString()}</p>
                </div>
                <div>
                    <p className="text-xs text-textMuted">Sold</p>
                    <p className="font-semibold text-text">{category.unitsSold.toString()}</p>
                </div>
            </div>

            {!isSoldOut && account && (
                <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-textMuted shrink-0">Units to buy:</label>
                        <Input
                            type="number"
                            min="1"
                            max={remaining.toString()}
                            value={units}
                            onChange={(e) => setUnits(e.target.value)}
                            className="w-24"
                        />
                        <p className="text-sm text-textMuted">
                            = <span className="font-semibold text-text">${fmt(costTotal)} USDC</span>
                        </p>
                    </div>

                    {needsApproval ? (
                        <>
                            <Button
                                onClick={handleApprove}
                                disabled={approveAction.state === 'pending' || approveAction.state === 'signing'}
                                className="w-full"
                            >
                                {approveAction.state === 'signing' || approveAction.state === 'pending' ? (
                                    <><Loader2 className="mr-2 size-4 animate-spin" /> Approving…</>
                                ) : (
                                    'Approve USDC Spend'
                                )}
                            </Button>
                            <TxStatus state={approveAction.state} hash={approveAction.transactionHash} error={approveAction.error} />
                        </>
                    ) : (
                        <>
                            <Button
                                variant="cc"
                                onClick={handleBuy}
                                disabled={buyAction.state === 'pending' || buyAction.state === 'signing' || clampedMax < 1}
                                className="w-full"
                            >
                                {buyAction.state === 'signing' || buyAction.state === 'pending' ? (
                                    <><Loader2 className="mr-2 size-4 animate-spin" /> Buying…</>
                                ) : buyAction.state === 'confirmed' ? (
                                    <><CheckCircle2 className="mr-2 size-4" /> Units Purchased!</>
                                ) : (
                                    `Buy ${clampedMax} Unit${clampedMax !== 1 ? 's' : ''}`
                                )}
                            </Button>
                            <TxStatus state={buyAction.state} hash={buyAction.transactionHash} error={buyAction.error} />
                        </>
                    )}
                </div>
            )}

            {isSoldOut && (
                <p className="mt-3 text-sm text-textMuted">This category is fully subscribed.</p>
            )}
            {!account && !isSoldOut && (
                <p className="mt-3 text-sm text-textMuted">Connect your wallet to invest.</p>
            )}
        </div>
    )
}

// ─── Deal Page ─────────────────────────────────────────────────────────────

export const DealDetailsPage = () => {
    const params = useParams<{ id: string }>()
    const batchId = parseInt(params.id ?? '0', 10)
    const { batch, isLoading, error, refetch } = useChainBatch(batchId)

    const { onChain, categories, meta } = batch ?? {}

    const progress =
        onChain && onChain.totalUnitsForSale > 0n
            ? Number((onChain.totalUnitsSold * 100n) / onChain.totalUnitsForSale)
            : 0

    const tone = onChain?.closed ? 'warning' : onChain?.active ? 'success' : 'signal'
    const statusLabel = onChain?.closed ? 'Closed' : onChain?.active ? 'Live Round' : 'Paused'

    return (
        <main className="space-y-6">
                {/* Back */}
                <div className="flex items-center justify-between">
                    <Link
                        href="/investor/marketplace"
                        className="inline-flex items-center gap-2 text-sm text-textMuted transition-colors hover:text-text"
                    >
                        <ArrowLeft className="size-4" /> Back to marketplace
                    </Link>
                    {onChain && <Badge tone={tone} label={statusLabel} />}
                </div>

                {/* Loading */}
                {isLoading && (
                    <div className="flex items-center gap-2 text-textMuted">
                        <Loader2 className="size-4 animate-spin" />
                        <span className="text-sm">Loading batch from chain…</span>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                        {error}
                    </div>
                )}

                {/* Batch not found */}
                {!isLoading && !error && batch && onChain?.id === 0n && (
                    <Card>
                        <p className="text-textMuted">Batch #{batchId} not found on-chain.</p>
                    </Card>
                )}

                {/* Content */}
                {!isLoading && batch && onChain && onChain.id > 0n && (
                    <>
                        {/* Header */}
                        <Card className="space-y-5">
                            <div className="flex flex-wrap items-start gap-5">
                                {/* Image */}
                                {meta?.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={meta.imageUrl}
                                        alt={meta.title}
                                        className="h-28 w-28 rounded-xl object-cover shrink-0"
                                    />
                                ) : (
                                    <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border border-line bg-panelMuted text-textMuted">
                                        <ImageIcon className="size-8 opacity-30" />
                                    </div>
                                )}

                                <div className="flex-1 min-w-0">
                                    <p className="text-xs uppercase tracking-[0.18em] text-gold">
                                        {meta?.sector ?? 'Tokenized Batch'}
                                    </p>
                                    <h1 className="mt-1 font-heading text-2xl text-text md:text-3xl">
                                        {meta?.title ?? `Batch #${onChain.id.toString()}`}
                                    </h1>
                                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-textMuted">
                                        {meta?.location && (
                                            <span className="inline-flex items-center gap-1.5">
                                                <MapPin className="size-4" /> {meta.location}
                                            </span>
                                        )}
                                        <span className="inline-flex items-center gap-1.5">
                                            Batch #{onChain.id.toString()}
                                        </span>
                                    </div>
                                </div>

                                {/* Progress widget */}
                                <div className="rounded-xl border border-line bg-panelMuted p-4 text-right shrink-0">
                                    <p className="text-xs uppercase tracking-[0.14em] text-textMuted">Funding Progress</p>
                                    <p className="mt-1 text-2xl font-semibold text-text">{progress}%</p>
                                    <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-line ml-auto">
                                        <div
                                            className="h-full rounded-full bg-teal"
                                            style={{ width: `${Math.min(progress, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {meta?.description && (
                                <p className="max-w-3xl text-sm leading-relaxed text-textMuted md:text-base">
                                    {meta.description}
                                </p>
                            )}
                        </Card>

                        {/* Stats */}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                            <Card className="space-y-1">
                                <p className="text-xs uppercase tracking-[0.16em] text-textMuted">Total Raised</p>
                                <p className="text-2xl font-semibold text-text">${fmt(onChain.principalSoldTotal)}</p>
                                <p className="text-xs text-textMuted">USDC principal</p>
                            </Card>
                            <Card className="space-y-1">
                                <p className="text-xs uppercase tracking-[0.16em] text-textMuted">Target Payout</p>
                                <p className="text-2xl font-semibold text-text">${fmt(onChain.targetPayoutTotal)}</p>
                                <p className="text-xs text-textMuted">incl. {(onChain.profitBps / 100).toFixed(1)}% profit</p>
                            </Card>
                            <Card className="space-y-1">
                                <p className="text-xs uppercase tracking-[0.16em] text-textMuted">Units Sold</p>
                                <p className="text-2xl font-semibold text-text">
                                    {onChain.totalUnitsSold.toString()} / {onChain.totalUnitsForSale.toString()}
                                </p>
                                <p className="inline-flex items-center gap-1 text-xs text-success">
                                    <TrendingUp className="size-3.5" /> {progress}% subscribed
                                </p>
                            </Card>
                            <Card className="space-y-1">
                                <p className="text-xs uppercase tracking-[0.16em] text-textMuted">Tracked Square Units</p>
                                <p className="text-2xl font-semibold text-text">{batch.trackedUnits.toString()}</p>
                                <p className="text-xs text-textMuted">synced from oracle index</p>
                            </Card>
                            <Card className="space-y-1">
                                <p className="text-xs uppercase tracking-[0.16em] text-textMuted">Revenue Settled</p>
                                <p className="text-2xl font-semibold text-text">${fmt(onChain.settledRevenueTotal)}</p>
                                <p className="text-xs text-textMuted">on-chain oracle data</p>
                            </Card>
                        </div>

                        {/* Buy Units */}
                        {!onChain.closed && (
                            <Card className="space-y-4">
                                <h2 className="font-heading text-lg font-semibold">
                                    Invest — Buy Units
                                </h2>
                                <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-xs text-amber-300 flex gap-2 items-start">
                                    <ShieldAlert className="size-4 mt-0.5 shrink-0" />
                                    <span>
                                        KYC / whitelist check is enforced on-chain. The transaction will revert if your
                                        wallet is not approved by the compliance contract.
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {categories && categories.length > 0 ? (
                                        categories.map((cat) => (
                                            <CategoryBuyCard
                                                key={cat.categoryIdHash}
                                                batchId={onChain.id}
                                                category={cat}
                                                purchaseToken={onChain.purchaseToken}
                                                onSuccess={refetch}
                                            />
                                        ))
                                    ) : (
                                        <p className="text-sm text-textMuted">No categories found for this batch.</p>
                                    )}
                                </div>
                            </Card>
                        )}

                        {onChain.closed && (
                            <div className="rounded-xl border border-line bg-panelMuted px-4 py-5 text-center text-sm text-textMuted">
                                This batch is closed and no longer accepting investments.
                            </div>
                        )}
                    </>
                )}
            </main>
    )
}
