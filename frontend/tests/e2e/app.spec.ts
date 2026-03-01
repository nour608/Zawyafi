import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('landing renders hero and wallet login action', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /Invest in Real Businesses/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()

  const accessibility = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(accessibility.violations).toEqual([])
})

test('marketplace renders API-driven listings and connect button', async ({ page }) => {
  await page.route('**/frontend/batches', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        apiVersion: '1',
        batches: [
          {
            batchId: 11,
            merchantIdHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
            productIdHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
            tokenSymbol: 'ZWY11',
            unitCostMinor: '1000',
            unitPayoutMinor: '1200',
            unitsForSale: '1000',
            unitsSoldToInvestors: '250',
            unitsSettled: '0',
            unitsClaimed: '0',
            active: true,
            riskTier: 'LOW',
            fundingLiquidityMinor: '300000',
          },
        ],
      }),
    })
  })

  await page.goto('/investor/marketplace')

  await expect(page.getByText('Batch #11')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible()
})
