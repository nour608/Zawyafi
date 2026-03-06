import type { DatabaseSync } from 'node:sqlite'
import type { Pool } from 'pg'

export interface ListingMeta {
    batchId: string
    title: string
    description: string
    imageUrl: string
    sector: string
    location: string
    createdAt: string
    updatedAt: string
}

// ─── SQLite Store ───────────────────────────────────────────────────────────

export class ListingStore {
    constructor(private readonly db: DatabaseSync) { }

    upsert(meta: Omit<ListingMeta, 'createdAt' | 'updatedAt'>): ListingMeta {
        const now = new Date().toISOString()
        this.db
            .prepare(
                `INSERT INTO listing_metadata
           (batch_id, title, description, image_url, sector, location, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(batch_id) DO UPDATE SET
           title       = excluded.title,
           description = excluded.description,
           image_url   = excluded.image_url,
           sector      = excluded.sector,
           location    = excluded.location,
           updated_at  = excluded.updated_at`,
            )
            .run(meta.batchId, meta.title, meta.description, meta.imageUrl, meta.sector, meta.location, now, now)
        return this.getOne(meta.batchId)!
    }

    getOne(batchId: string): ListingMeta | null {
        const row = this.db
            .prepare('SELECT * FROM listing_metadata WHERE batch_id = ?')
            .get(batchId) as unknown as RawRow | undefined
        return row ? toListingMeta(row) : null
    }

    getAll(): ListingMeta[] {
        const rows = this.db
            .prepare('SELECT * FROM listing_metadata ORDER BY updated_at DESC')
            .all() as unknown as RawRow[]
        return rows.map(toListingMeta)
    }
}

// ─── PostgreSQL Store ───────────────────────────────────────────────────────

export class PgListingStore {
    constructor(private readonly pool: Pool) { }

    async upsert(meta: Omit<ListingMeta, 'createdAt' | 'updatedAt'>): Promise<ListingMeta> {
        const now = new Date().toISOString()
        const { rows } = await this.pool.query<RawRow>(
            `INSERT INTO listing_metadata
         (batch_id, title, description, image_url, sector, location, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (batch_id) DO UPDATE SET
         title       = EXCLUDED.title,
         description = EXCLUDED.description,
         image_url   = EXCLUDED.image_url,
         sector      = EXCLUDED.sector,
         location    = EXCLUDED.location,
         updated_at  = EXCLUDED.updated_at
       RETURNING *`,
            [meta.batchId, meta.title, meta.description, meta.imageUrl, meta.sector, meta.location, now, now],
        )
        return toListingMeta(rows[0]!)
    }

    async getOne(batchId: string): Promise<ListingMeta | null> {
        const { rows } = await this.pool.query<RawRow>(
            'SELECT * FROM listing_metadata WHERE batch_id = $1',
            [batchId],
        )
        return rows[0] ? toListingMeta(rows[0]) : null
    }

    async getAll(): Promise<ListingMeta[]> {
        const { rows } = await this.pool.query<RawRow>(
            'SELECT * FROM listing_metadata ORDER BY updated_at DESC',
        )
        return rows.map(toListingMeta)
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

interface RawRow {
    batch_id: string
    title: string
    description: string
    image_url: string
    sector: string
    location: string
    created_at: string
    updated_at: string
}

const toListingMeta = (row: RawRow): ListingMeta => ({
    batchId: row.batch_id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    sector: row.sector,
    location: row.location,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
})
