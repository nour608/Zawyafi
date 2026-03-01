import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

interface CafeProduct {
  name: string
  priceMinor: number
}

interface CafeCategory {
  name: string
  products: CafeProduct[]
}

interface CafeInventory {
  name: string
  categories: CafeCategory[]
}

const loadInventory = (): CafeInventory => {
  const inventoryPath = path.resolve(process.cwd(), 'data', 'cafe-inventory.json')
  const raw = fs.readFileSync(inventoryPath, 'utf8')
  return JSON.parse(raw) as CafeInventory
}

describe('cafe inventory fixture', () => {
  it('has exactly 3 categories and each category has exactly 3 products', () => {
    const inventory = loadInventory()

    expect(inventory.categories).toHaveLength(3)
    for (const category of inventory.categories) {
      expect(category.products).toHaveLength(3)
    }
  })

  it('contains realistic positive prices in USD minor units', () => {
    const inventory = loadInventory()
    const prices = inventory.categories.flatMap((category) => category.products.map((product) => product.priceMinor))

    for (const price of prices) {
      expect(Number.isInteger(price)).toBe(true)
      expect(price).toBeGreaterThanOrEqual(250)
      expect(price).toBeLessThanOrEqual(1500)
    }
  })

  it('keeps stable category names used by seed data', () => {
    const inventory = loadInventory()
    const names = inventory.categories.map((category) => category.name)

    expect(names).toEqual(['Coffee', 'Bakery', 'Sandwiches'])
  })
})
