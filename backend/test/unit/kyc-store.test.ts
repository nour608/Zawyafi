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
})
