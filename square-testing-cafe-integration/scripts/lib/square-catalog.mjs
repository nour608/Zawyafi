import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const libFile = fileURLToPath(import.meta.url)
const libDir = path.dirname(libFile)

export const ENV_PATH = path.resolve(libDir, '..', '..', '.env')
export const INVENTORY_PATH = path.resolve(libDir, '..', '..', 'data', 'cafe-inventory.json')

export const loadDotEnv = () => {
  if (!fs.existsSync(ENV_PATH)) {
    return
  }

  const content = fs.readFileSync(ENV_PATH, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const equalIndex = line.indexOf('=')
    if (equalIndex <= 0) {
      continue
    }

    const key = line.slice(0, equalIndex).trim()
    let value = line.slice(equalIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

export const mustGetEnv = (name) => {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`)
  }

  return value
}

export const formatErrors = (payload) => {
  const lines = (payload.errors ?? []).map(
    (item) => `${item.category ?? 'unknown'}/${item.code ?? 'unknown'}: ${item.detail ?? 'no detail'}`,
  )
  return lines.join('; ')
}

export const requestJson = async (input) => {
  const query = input.query instanceof URLSearchParams ? `?${input.query.toString()}` : ''
  const response = await fetch(`${input.baseUrl}${input.path}${query}`, {
    method: input.method,
    headers: {
      Authorization: `Bearer ${input.token}`,
      'Square-Version': input.version,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
  })

  const text = await response.text()
  const json = text.length > 0 ? JSON.parse(text) : {}

  if (!response.ok) {
    const details = typeof json === 'object' && json !== null ? formatErrors(json) : text
    throw new Error(`Square API ${input.method} ${input.path} failed (${response.status}): ${details}`)
  }

  return json
}

export const loadCafeInventory = () => {
  if (!fs.existsSync(INVENTORY_PATH)) {
    throw new Error(`Inventory file not found: ${INVENTORY_PATH}`)
  }

  const parsed = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'))
  const categories = Array.isArray(parsed?.categories) ? parsed.categories : []

  if (categories.length !== 3) {
    throw new Error(`Inventory must have exactly 3 categories. Found: ${categories.length}`)
  }

  for (const category of categories) {
    const products = Array.isArray(category?.products) ? category.products : []
    if (products.length !== 3) {
      throw new Error(
        `Category "${category?.name ?? 'unknown'}" must have exactly 3 products. Found: ${products.length}`,
      )
    }
  }

  return {
    name: parsed?.name ?? 'Cafe',
    categories,
  }
}

const slugify = (value) =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const listCatalogObjectsByTypes = async ({ token, baseUrl, version, types }) => {
  const objects = []
  let cursor

  do {
    const query = new URLSearchParams({
      types: types.join(','),
    })
    if (cursor) {
      query.set('cursor', cursor)
    }

    const json = await requestJson({
      method: 'GET',
      path: '/v2/catalog/list',
      token,
      baseUrl,
      version,
      query,
    })

    const page = Array.isArray(json.objects) ? json.objects : []
    objects.push(...page)
    cursor = typeof json.cursor === 'string' && json.cursor.length > 0 ? json.cursor : undefined
  } while (cursor)

  return objects
}

const makeCategoryNameKey = (name) => String(name).trim().toLowerCase()
const makeItemKey = (categoryId, itemName) => `${categoryId.toLowerCase()}::${String(itemName).trim().toLowerCase()}`

export const ensureCafeCatalog = async ({ token, baseUrl, version, inventory, currency, logger = console }) => {
  const normalizedCurrency = String(currency ?? 'USD').toUpperCase()
  const existingObjects = await listCatalogObjectsByTypes({
    token,
    baseUrl,
    version,
    types: ['CATEGORY', 'ITEM'],
  })

  const categoryByNameKey = new Map()
  const itemByKey = new Map()

  for (const object of existingObjects) {
    if (object?.type === 'CATEGORY') {
      const name = object?.category_data?.name
      if (typeof object.id === 'string' && typeof name === 'string') {
        categoryByNameKey.set(makeCategoryNameKey(name), { id: object.id, name })
      }
    }

    if (object?.type === 'ITEM') {
      const itemName = object?.item_data?.name
      const categoryId = object?.item_data?.category_id
      const variations = Array.isArray(object?.item_data?.variations) ? object.item_data.variations : []
      const firstVariation = variations.find((variation) => typeof variation?.id === 'string')
      const variationId = firstVariation?.id
      const priceMoney = firstVariation?.item_variation_data?.price_money
      const priceMinor = typeof priceMoney?.amount === 'number' ? priceMoney.amount : undefined

      if (
        typeof object.id === 'string' &&
        typeof itemName === 'string' &&
        typeof categoryId === 'string' &&
        typeof variationId === 'string'
      ) {
        itemByKey.set(makeItemKey(categoryId, itemName), {
          itemId: object.id,
          variationId,
          itemName,
          categoryId,
          priceMinor,
        })
      }
    }
  }

  const categoryResults = []
  const productResults = []

  for (const category of inventory.categories) {
    const categoryKey = makeCategoryNameKey(category.name)
    let categoryRecord = categoryByNameKey.get(categoryKey)

    if (!categoryRecord) {
      const tempCategoryId = `#category-${slugify(category.name)}-${randomUUID().slice(0, 8)}`
      const response = await requestJson({
        method: 'POST',
        path: '/v2/catalog/object',
        token,
        baseUrl,
        version,
        body: {
          idempotency_key: randomUUID(),
          object: {
            id: tempCategoryId,
            type: 'CATEGORY',
            category_data: {
              name: category.name,
            },
          },
        },
      })

      const createdId = response?.catalog_object?.id
      if (typeof createdId !== 'string' || createdId.length === 0) {
        throw new Error(`Failed to create category "${category.name}"`)
      }

      categoryRecord = {
        id: createdId,
        name: category.name,
      }
      categoryByNameKey.set(categoryKey, categoryRecord)
      logger.log(`Created category: ${category.name} (${createdId})`)
    } else {
      logger.log(`Category exists: ${category.name} (${categoryRecord.id})`)
    }

    categoryResults.push({
      name: category.name,
      id: categoryRecord.id,
    })

    for (const product of category.products) {
      const itemKey = makeItemKey(categoryRecord.id, product.name)
      const existingItem = itemByKey.get(itemKey)

      if (existingItem) {
        productResults.push({
          categoryName: category.name,
          itemName: product.name,
          priceMinor: product.priceMinor,
          itemId: existingItem.itemId,
          variationId: existingItem.variationId,
        })
        logger.log(`Item exists: ${category.name}/${product.name} (${existingItem.itemId})`)
        continue
      }

      const tempItemId = `#item-${slugify(category.name)}-${slugify(product.name)}-${randomUUID().slice(0, 8)}`
      const tempVariationId = `#var-${slugify(product.name)}-${randomUUID().slice(0, 8)}`

      const response = await requestJson({
        method: 'POST',
        path: '/v2/catalog/object',
        token,
        baseUrl,
        version,
        body: {
          idempotency_key: randomUUID(),
          object: {
            id: tempItemId,
            type: 'ITEM',
            item_data: {
              name: product.name,
              category_id: categoryRecord.id,
              variations: [
                {
                  id: tempVariationId,
                  type: 'ITEM_VARIATION',
                  item_variation_data: {
                    name: 'Regular',
                    pricing_type: 'FIXED_PRICING',
                    price_money: {
                      amount: product.priceMinor,
                      currency: normalizedCurrency,
                    },
                  },
                },
              ],
            },
          },
        },
      })

      const createdItem = response?.catalog_object
      const createdItemId = createdItem?.id
      const createdVariation = Array.isArray(createdItem?.item_data?.variations)
        ? createdItem.item_data.variations.find((variation) => typeof variation?.id === 'string')
        : undefined
      const createdVariationId = createdVariation?.id

      if (typeof createdItemId !== 'string' || typeof createdVariationId !== 'string') {
        throw new Error(`Failed to create item "${category.name}/${product.name}"`)
      }

      itemByKey.set(itemKey, {
        itemId: createdItemId,
        variationId: createdVariationId,
        itemName: product.name,
        categoryId: categoryRecord.id,
        priceMinor: product.priceMinor,
      })

      productResults.push({
        categoryName: category.name,
        itemName: product.name,
        priceMinor: product.priceMinor,
        itemId: createdItemId,
        variationId: createdVariationId,
      })

      logger.log(`Created item: ${category.name}/${product.name} (${createdItemId})`)
    }
  }

  return {
    categories: categoryResults,
    items: productResults,
    currency: normalizedCurrency,
  }
}
