'use client'

import { useEffect, useState } from 'react'
import { getContractEvents, prepareEvent, readContract } from 'thirdweb'
import { encodeAbiParameters, keccak256, parseAbiParameters } from 'viem'
import { type ListingMeta, listingStore } from '@/lib/listing-store'
import { contracts } from '@/lib/web3/contracts'
import { apiClient } from '@/lib/api/client'
import type { BatchView } from '@/lib/types/frontend'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CategoryState {
    categoryIdHash: `0x${string}`
    unitsForSale: bigint
    unitsSold: bigint
    unitCost: bigint
    principalSold: bigint
    tokenized: boolean
}

export interface BatchOnChain {
    id: bigint
    merchantIdHash: `0x${string}`
    issuer: string
    founder: string
    purchaseToken: string
    unitToken: string
    profitBps: number
    principalSoldTotal: bigint
    targetPayoutTotal: bigint
    settledRevenueTotal: bigint
    totalUnitsForSale: bigint
    totalUnitsSold: bigint
    proceedsWithdrawn: bigint
    active: boolean
    closed: boolean
}

export interface EnrichedBatch {
    onChain: BatchOnChain
    categories: CategoryState[]
    meta?: ListingMeta
    frontendBatch?: BatchView
    trackedUnits: bigint
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export const useChainBatches = () => {
    const [batches, setBatches] = useState<EnrichedBatch[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [refetchTick, setRefetchTick] = useState(0)

    const refetch = () => setRefetchTick((t) => t + 1)

    useEffect(() => {
        let cancelled = false

        const load = async () => {
            setIsLoading(true)
            setError(null)

            try {
                // 1. How many batches exist?
                const nextId = await readContract({
                    contract: contracts.factory,
                    method: 'function nextBatchId() view returns (uint256)',
                    params: [],
                })

                const count = Number(nextId) // nextBatchId starts at 1, so IDs are [1 … count-1]
                if (count <= 1) {
                    if (!cancelled) {
                        setBatches([])
                        setIsLoading(false)
                    }
                    return
                }

                // 2. Fetch all batches in parallel
                const batchIds = Array.from({ length: count - 1 }, (_, i) => BigInt(i + 1))

                const batchResults = await Promise.all(
                    batchIds.map((batchId) =>
                        readContract({
                            contract: contracts.factory,
                            method:
                                'function getBatch(uint256) view returns ((uint256 id, bytes32 merchantIdHash, address issuer, address founder, address purchaseToken, address unitToken, uint16 profitBps, uint256 principalSoldTotal, uint256 targetPayoutTotal, uint256 settledRevenueTotal, uint256 totalUnitsForSale, uint256 totalUnitsSold, uint256 proceedsWithdrawn, bool active, bool closed))',
                            params: [batchId],
                        }),
                    ),
                )

                // 3. Fetch category hashes per batch
                const hashResults = await Promise.all(
                    batchIds.map((batchId) =>
                        readContract({
                            contract: contracts.factory,
                            method: 'function getBatchCategoryHashes(uint256) view returns (bytes32[])',
                            params: [batchId],
                        }),
                    ),
                )

                // 4. Fetch category states
                const categoryResults = await Promise.all(
                    batchIds.map(async (batchId, index) => {
                        const hashes = hashResults[index] ?? []
                        if (hashes.length === 0) return []
                        return Promise.all(
                            hashes.map((hash) =>
                                readContract({
                                    contract: contracts.factory,
                                    method:
                                        'function getCategoryState(uint256, bytes32) view returns ((bytes32 categoryIdHash, uint256 unitsForSale, uint256 unitsSold, uint256 unitCost, uint256 principalSold, bool tokenized))',
                                    params: [batchId, hash as `0x${string}`],
                                }),
                            ),
                        )
                    }),
                )

                if (cancelled) return

                // 5. Fetch all listing metadata from the backend in one call
                const allMeta = await listingStore.list()
                const metaByBatchId = new Map(allMeta.map((m) => [m.batchId, m]))

                // 5.5 Fetch frontend indexer batches
                let indexerBatches: BatchView[] = []
                try {
                    const res = await apiClient.getBatches()
                    indexerBatches = res.batches
                } catch (e) {
                    console.error('Failed to fetch frontend batches:', e)
                }

                // 6. Merge on-chain + metadata + indexer
                const enriched: EnrichedBatch[] = batchResults.map((raw, i) => {
                    const batch = raw as BatchOnChain
                    return {
                        onChain: batch,
                        categories: (categoryResults[i] ?? []) as CategoryState[],
                        meta: metaByBatchId.get(String(batch.id)),
                        frontendBatch: indexerBatches.find((b) => Number(b.batchId) === Number(batch.id)),
                        trackedUnits: 0n,
                    }
                })

                setBatches(enriched)
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load batches from chain')
                }
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        }

        void load()
        return () => {
            cancelled = true
        }
    }, [refetchTick])

    return { batches, isLoading, error, refetch }
}

/** Single-batch version — used on the deal page. */
export const useChainBatch = (batchId: number) => {
    const [batch, setBatch] = useState<EnrichedBatch | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [refetchTick, setRefetchTick] = useState(0)

    const refetch = () => setRefetchTick((t) => t + 1)

    useEffect(() => {
        if (!batchId || batchId < 1) {
            setIsLoading(false)
            return
        }

        let cancelled = false
        const id = BigInt(batchId)

        const load = async () => {
            setIsLoading(true)
            setError(null)

            try {
                const rawBatch = await readContract({
                    contract: contracts.factory,
                    method:
                        'function getBatch(uint256) view returns ((uint256 id, bytes32 merchantIdHash, address issuer, address founder, address purchaseToken, address unitToken, uint16 profitBps, uint256 principalSoldTotal, uint256 targetPayoutTotal, uint256 settledRevenueTotal, uint256 totalUnitsForSale, uint256 totalUnitsSold, uint256 proceedsWithdrawn, bool active, bool closed))',
                    params: [id],
                })

                const hashes = await readContract({
                    contract: contracts.factory,
                    method: 'function getBatchCategoryHashes(uint256) view returns (bytes32[])',
                    params: [id],
                })

                const categories = await Promise.all(
                    (hashes as `0x${string}`[]).map((hash) =>
                        readContract({
                            contract: contracts.factory,
                            method:
                                'function getCategoryState(uint256, bytes32) view returns ((bytes32 categoryIdHash, uint256 unitsForSale, uint256 unitsSold, uint256 unitCost, uint256 principalSold, bool tokenized))',
                            params: [id, hash],
                        }),
                    ),
                )

                if (cancelled) return

                const meta = await listingStore.get(batchId)
                let frontendBatch: BatchView | undefined
                try {
                    const res = await apiClient.getBatch(batchId)
                    frontendBatch = res.batches[0]
                } catch (e) {
                    console.error('Failed to fetch frontend batch:', e)
                }

                let trackedUnits = 0n
                try {
                    const targetHash = keccak256(encodeAbiParameters(parseAbiParameters('uint256'), [id]))
                    const events = await getContractEvents({
                        contract: contracts.revenueRegistry,
                        events: [
                            prepareEvent({
                                signature:
                                    'event PeriodRecorded(bytes32 indexed periodId, bytes32 indexed merchantIdHash, bytes32 indexed productIdHash, uint8 status, uint256 netUnitsSold, bytes32 batchHash)',
                            }),
                        ],
                    })

                    const matched = events.filter((e) => (e.args as { batchHash: string }).batchHash === targetHash)
                    for (const ev of matched) {
                        trackedUnits += (ev.args as { netUnitsSold: bigint }).netUnitsSold
                    }
                } catch (err) {
                    console.error('Failed to fetch RevenueRegistry events:', err)
                }

                const onChain = rawBatch as BatchOnChain
                setBatch({
                    onChain,
                    categories: categories as CategoryState[],
                    meta: meta,
                    frontendBatch,
                    trackedUnits,
                })
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load batch')
                }
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        }

        void load()
        return () => {
            cancelled = true
        }
    }, [batchId, refetchTick])

    return { batch, isLoading, error, refetch }
}
