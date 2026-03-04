import { openDatabase } from '../../src/db'
import { AppError } from '../../src/errors'
import { KycStore } from '../../src/kyc-store'

describe('KycStore', () => {
  const baseNow = new Date('2026-02-22T12:00:00.000Z')

  it('runs happy path from start to onchain approval', () => {
    const db = openDatabase(':memory:')
    const store = new KycStore(db)

    const created = store.createRequest(
      {
        wallet: '0xA2Cd38C20Aa36a1D7d1569289D9B61E9b01a2cd7',
        chainId: 11155111,
        nonce: 'nonce-1',
      },
      baseNow,
    )

    const bound = store.bindApplicant(
      {
        requestId: created.requestId,
        commit: 'abc123'.repeat(10),
        applicantId: 'sumsub-applicant-1',
        sdkToken: 'sdk-token-1',
        keyVersion: 'v1',
      },
      new Date(baseNow.getTime() + 1_000),
    )

    expect(bound.status).toBe('PENDING_USER_SUBMISSION')

    const reviewed = store.applySumsubReview(
      {
        applicantId: 'sumsub-applicant-1',
        reviewAnswer: 'GREEN',
      },
      new Date(baseNow.getTime() + 2_000),
    )

    expect(reviewed?.status).toBe('APPROVED_READY')

    const claimed = store.claimReadyOnchain(10, 120, new Date(baseNow.getTime() + 3_000))
    expect(claimed).toHaveLength(1)
    expect(claimed[0].status).toBe('APPROVED_ONCHAIN_PENDING')

    const settled = store.recordOnchainResult(
      {
        requestId: created.requestId,
        txHash: '0x' + '11'.repeat(32),
        outcome: 'SUCCESS',
        retryBaseDelaySeconds: 30,
      },
      new Date(baseNow.getTime() + 4_000),
    )

    expect(settled.status).toBe('ONCHAIN_APPROVED')
    expect(settled.onchainTxHash).toBe('0x' + '11'.repeat(32))
  })

  it('enforces status transitions', () => {
    const db = openDatabase(':memory:')
    const store = new KycStore(db)

    const created = store.createRequest(
      {
        wallet: '0xA2Cd38C20Aa36a1D7d1569289D9B61E9b01a2cd7',
        chainId: 11155111,
        nonce: 'nonce-1',
      },
      baseNow,
    )

    expect(() =>
      store.recordOnchainResult(
        {
          requestId: created.requestId,
          outcome: 'SUCCESS',
          txHash: '0x' + '22'.repeat(32),
          retryBaseDelaySeconds: 30,
        },
        new Date(baseNow.getTime() + 1_000),
      ),
    ).toThrow(AppError)
  })

  it('uses webhook event idempotency key', () => {
    const db = openDatabase(':memory:')
    const store = new KycStore(db)

    const first = store.recordWebhookEvent(
      {
        eventId: 'evt-1',
        applicantId: 'app-1',
        payloadHash: 'hash-1',
      },
      baseNow,
    )

    const second = store.recordWebhookEvent(
      {
        eventId: 'evt-1',
        applicantId: 'app-1',
        payloadHash: 'hash-1',
      },
      new Date(baseNow.getTime() + 1_000),
    )

    expect(first).toBe(true)
    expect(second).toBe(false)
  })

  it('does not downgrade requests that are already onchain approved', () => {
    const db = openDatabase(':memory:')
    const store = new KycStore(db)

    const created = store.createRequest(
      {
        wallet: '0xA2Cd38C20Aa36a1D7d1569289D9B61E9b01a2cd7',
        chainId: 11155111,
        nonce: 'nonce-1',
      },
      baseNow,
    )

    store.bindApplicant(
      {
        requestId: created.requestId,
        commit: 'abc123'.repeat(10),
        applicantId: 'sumsub-applicant-1',
        sdkToken: 'sdk-token-1',
        keyVersion: 'v1',
      },
      new Date(baseNow.getTime() + 1_000),
    )

    store.applySumsubReview(
      {
        applicantId: 'sumsub-applicant-1',
        reviewAnswer: 'GREEN',
      },
      new Date(baseNow.getTime() + 2_000),
    )

    const claimed = store.claimReadyOnchain(10, 120, new Date(baseNow.getTime() + 3_000))
    expect(claimed).toHaveLength(1)

    const settled = store.recordOnchainResult(
      {
        requestId: created.requestId,
        txHash: '0x' + '11'.repeat(32),
        outcome: 'SUCCESS',
        retryBaseDelaySeconds: 30,
      },
      new Date(baseNow.getTime() + 4_000),
    )
    expect(settled.status).toBe('ONCHAIN_APPROVED')

    const afterLateWebhook = store.applySumsubReview(
      {
        applicantId: 'sumsub-applicant-1',
        reviewAnswer: 'RED',
      },
      new Date(baseNow.getTime() + 5_000),
    )

    expect(afterLateWebhook?.status).toBe('ONCHAIN_APPROVED')
  })

  it('lists requests with status, wallet, and cursor filters', () => {
    const db = openDatabase(':memory:')
    const store = new KycStore(db)

    const walletOne = '0xA2Cd38C20Aa36a1D7d1569289D9B61E9b01a2cd7'
    const walletTwo = '0xB2Cd38C20Aa36a1D7d1569289D9B61E9b01a2cd7'

    const first = store.createRequest({ wallet: walletOne, chainId: 11155111, nonce: 'n-1' }, new Date(baseNow.getTime() + 1_000))
    const second = store.createRequest({ wallet: walletTwo, chainId: 11155111, nonce: 'n-2' }, new Date(baseNow.getTime() + 2_000))
    const third = store.createRequest({ wallet: walletOne, chainId: 11155111, nonce: 'n-3' }, new Date(baseNow.getTime() + 3_000))

    db.prepare(`UPDATE kyc_requests SET status = ?, updated_at = ? WHERE request_id = ?`).run(
      'ONCHAIN_APPROVED',
      new Date(baseNow.getTime() + 10_000).toISOString(),
      first.requestId,
    )
    db.prepare(`UPDATE kyc_requests SET status = ?, updated_at = ? WHERE request_id = ?`).run(
      'FAILED_TERMINAL',
      new Date(baseNow.getTime() + 20_000).toISOString(),
      second.requestId,
    )
    db.prepare(`UPDATE kyc_requests SET status = ?, updated_at = ? WHERE request_id = ?`).run(
      'ONCHAIN_APPROVED',
      new Date(baseNow.getTime() + 30_000).toISOString(),
      third.requestId,
    )

    const firstPage = store.listRequests({ status: 'ONCHAIN_APPROVED', offset: 0, limit: 1 })
    expect(firstPage.records).toHaveLength(1)
    expect(firstPage.records[0]?.requestId).toBe(third.requestId)
    expect(firstPage.nextCursor).toBe('1')

    const secondPage = store.listRequests({ status: 'ONCHAIN_APPROVED', offset: Number(firstPage.nextCursor), limit: 1 })
    expect(secondPage.records).toHaveLength(1)
    expect(secondPage.records[0]?.requestId).toBe(first.requestId)
    expect(secondPage.nextCursor).toBeNull()

    const walletFiltered = store.listRequests({
      wallet: walletTwo.toLowerCase(),
      offset: 0,
      limit: 10,
    })
    expect(walletFiltered.records).toHaveLength(1)
    expect(walletFiltered.records[0]?.requestId).toBe(second.requestId)
  })

  it('lists latest wallet states with optional status filtering', () => {
    const db = openDatabase(':memory:')
    const store = new KycStore(db)

    const walletOne = '0xA2Cd38C20Aa36a1D7d1569289D9B61E9b01a2cd7'
    const walletTwo = '0xB2Cd38C20Aa36a1D7d1569289D9B61E9b01a2cd7'

    const oldWalletOne = store.createRequest({ wallet: walletOne, chainId: 11155111, nonce: 'n-old' }, new Date(baseNow.getTime() + 1_000))
    const latestWalletOne = store.createRequest({ wallet: walletOne, chainId: 11155111, nonce: 'n-latest' }, new Date(baseNow.getTime() + 2_000))
    const walletTwoRecord = store.createRequest({ wallet: walletTwo, chainId: 11155111, nonce: 'n-two' }, new Date(baseNow.getTime() + 3_000))

    db.prepare(`UPDATE kyc_requests SET status = ?, updated_at = ? WHERE request_id = ?`).run(
      'FAILED_TERMINAL',
      new Date(baseNow.getTime() + 10_000).toISOString(),
      oldWalletOne.requestId,
    )
    db.prepare(`UPDATE kyc_requests SET status = ?, updated_at = ? WHERE request_id = ?`).run(
      'ONCHAIN_APPROVED',
      new Date(baseNow.getTime() + 20_000).toISOString(),
      latestWalletOne.requestId,
    )
    db.prepare(`UPDATE kyc_requests SET status = ?, updated_at = ? WHERE request_id = ?`).run(
      'FAILED_TERMINAL',
      new Date(baseNow.getTime() + 30_000).toISOString(),
      walletTwoRecord.requestId,
    )

    const latest = store.listLatestWalletStates({ offset: 0, limit: 10 })
    expect(latest.records).toHaveLength(2)
    expect(latest.records[0]?.requestId).toBe(walletTwoRecord.requestId)
    expect(latest.records[1]?.requestId).toBe(latestWalletOne.requestId)

    const approvedOnly = store.listLatestWalletStates({ status: 'ONCHAIN_APPROVED', offset: 0, limit: 10 })
    expect(approvedOnly.records).toHaveLength(1)
    expect(approvedOnly.records[0]?.requestId).toBe(latestWalletOne.requestId)
  })
})
