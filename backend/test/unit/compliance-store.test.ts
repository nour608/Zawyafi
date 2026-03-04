import { ComplianceStore } from '../../src/compliance-store'
import { openDatabase } from '../../src/db'

describe('ComplianceStore', () => {
  const baseNow = new Date('2026-02-28T12:00:00.000Z')

  it('lists report requests with filters and cursor', () => {
    const db = openDatabase(':memory:')
    const store = new ComplianceStore(db)

    const first = store.createRequest(
      {
        merchantIdHash: `0x${'11'.repeat(32)}`,
        startDate: '2026-02-01',
        endDate: '2026-02-28',
      },
      new Date(baseNow.getTime() + 1_000),
    )
    const second = store.createRequest(
      {
        merchantIdHash: `0x${'22'.repeat(32)}`,
        startDate: '2026-02-01',
        endDate: '2026-02-28',
      },
      new Date(baseNow.getTime() + 2_000),
    )
    const third = store.createRequest(
      {
        merchantIdHash: `0x${'11'.repeat(32)}`,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      },
      new Date(baseNow.getTime() + 3_000),
    )

    db.prepare(`UPDATE compliance_report_requests SET status = ?, updated_at = ? WHERE request_id = ?`).run(
      'SUCCEEDED',
      new Date(baseNow.getTime() + 10_000).toISOString(),
      first.requestId,
    )
    db.prepare(`UPDATE compliance_report_requests SET status = ?, updated_at = ? WHERE request_id = ?`).run(
      'FAILED',
      new Date(baseNow.getTime() + 20_000).toISOString(),
      second.requestId,
    )
    db.prepare(`UPDATE compliance_report_requests SET status = ?, updated_at = ? WHERE request_id = ?`).run(
      'SUCCEEDED',
      new Date(baseNow.getTime() + 30_000).toISOString(),
      third.requestId,
    )

    const pageOne = store.listRequests({ status: 'SUCCEEDED', offset: 0, limit: 1 })
    expect(pageOne.records).toHaveLength(1)
    expect(pageOne.records[0]?.requestId).toBe(third.requestId)
    expect(pageOne.nextCursor).toBe('1')

    const pageTwo = store.listRequests({ status: 'SUCCEEDED', offset: Number(pageOne.nextCursor), limit: 1 })
    expect(pageTwo.records).toHaveLength(1)
    expect(pageTwo.records[0]?.requestId).toBe(first.requestId)
    expect(pageTwo.nextCursor).toBeNull()

    const merchantFiltered = store.listRequests({
      merchantIdHash: `0x${'22'.repeat(32)}`,
      offset: 0,
      limit: 10,
    })
    expect(merchantFiltered.records).toHaveLength(1)
    expect(merchantFiltered.records[0]?.requestId).toBe(second.requestId)
  })
})
