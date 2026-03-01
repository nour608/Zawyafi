import { describe, expect, it } from 'vitest'
import { filterMarketplaceCards, mapBatchToMarketplaceCard } from '@/features/investor/investor-marketplace'
import type { BatchView } from '@/lib/types/frontend'

const sampleBatch: BatchView = {
  batchId: 7,
  merchantIdHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
  productIdHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
  tokenSymbol: 'ZWY',
  unitCostMinor: '1000',
  unitPayoutMinor: '1200',
  unitsForSale: '100',
  unitsSoldToInvestors: '30',
  unitsSettled: '0',
  unitsClaimed: '0',
  active: true,
  riskTier: 'LOW',
  fundingLiquidityMinor: '45000',
}

describe('investor marketplace mapping', () => {
  it('maps batch values into marketplace card model', () => {
    const card = mapBatchToMarketplaceCard(sampleBatch)

    expect(card.batchId).toBe(7)
    expect(card.title).toBe('Batch #7')
    expect(card.availableUnits).toBe('70')
    expect(card.soldPercent).toBe(30)
  })

  it('filters by status, risk and search term', () => {
    const cards = [
      mapBatchToMarketplaceCard(sampleBatch),
      mapBatchToMarketplaceCard({ ...sampleBatch, batchId: 8, tokenSymbol: 'QRT', active: false, riskTier: 'HIGH' }),
    ]

    expect(filterMarketplaceCards(cards, 'LIVE', '').length).toBe(1)
    expect(filterMarketplaceCards(cards, 'PAUSED', '').length).toBe(1)
    expect(filterMarketplaceCards(cards, 'HIGH_RISK', '').length).toBe(1)
    expect(filterMarketplaceCards(cards, 'ALL', 'zwy').length).toBe(1)
  })
})
