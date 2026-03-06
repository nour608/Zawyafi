// Backend-persisted listing metadata store.
// On-chain data (units, cost, status) always comes from the contract.
// This store holds admin-authored content: title, description, image, sector, location.
// Stored in the backend DB (SQLite locally, PostgreSQL in production).

import { env } from '@/lib/env'
import { getWalletApiAuthHeaders, type WalletAuthAccount } from '@/lib/api/wallet-auth'

export interface ListingMeta {
    batchId: string   // on-chain batchId as string (e.g. "1")
    title: string
    description: string
    imageUrl: string
    sector: string
    location: string
}

const base = () => env.NEXT_PUBLIC_BACKEND_BASE_URL

// ─── Read helpers (public, no auth) ────────────────────────────────────────

export const listingStore = {
    /** Get metadata for a single batch, or undefined if not found. */
    async get(batchId: string | number): Promise<ListingMeta | undefined> {
        try {
            const res = await fetch(`${base()}/listings/${batchId}`, { cache: 'no-store' })
            if (res.status === 404) return undefined
            if (!res.ok) return undefined
            const data = await res.json() as ListingMeta
            return data
        } catch {
            return undefined
        }
    },

    /** List all listings' metadata. */
    async list(): Promise<ListingMeta[]> {
        try {
            const res = await fetch(`${base()}/listings`, { cache: 'no-store' })
            if (!res.ok) return []
            const data = await res.json() as { listings: ListingMeta[] }
            return data.listings ?? []
        } catch {
            return []
        }
    },

    /** Upsert metadata — requires admin wallet auth. Called from admin dashboard. */
    async set(meta: ListingMeta, account: WalletAuthAccount): Promise<ListingMeta> {
        const authHeaders = await getWalletApiAuthHeaders(account, base())
        const res = await fetch(`${base()}/listings/${meta.batchId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders,
            },
            body: JSON.stringify({
                title: meta.title,
                description: meta.description,
                imageUrl: meta.imageUrl,
                sector: meta.sector,
                location: meta.location,
            }),
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({})) as { message?: string }
            throw new Error(err.message ?? `Failed to save listing (${res.status})`)
        }
        return res.json() as Promise<ListingMeta>
    },
}
