import { ensureCafeCatalog, loadCafeInventory, loadDotEnv, mustGetEnv } from './lib/square-catalog.mjs'

loadDotEnv()

const main = async () => {
  const token = mustGetEnv('SQUARE_PAT_FALLBACK_TOKEN')
  const baseUrl = process.env.SQUARE_BASE_URL ?? 'https://connect.squareupsandbox.com'
  const version = process.env.SQUARE_VERSION ?? '2026-01-22'
  const currency = (process.env.SEED_CURRENCY ?? 'USD').toUpperCase()

  const inventory = loadCafeInventory()

  console.log(`Ensuring Square catalog for ${inventory.name}`)
  console.log(`Base URL: ${baseUrl}`)
  console.log(`Currency: ${currency}`)

  const result = await ensureCafeCatalog({
    token,
    baseUrl,
    version,
    inventory,
    currency,
    logger: console,
  })

  console.log('---')
  console.log('Square catalog setup complete')
  console.log(`Categories ensured: ${result.categories.length}`)
  console.log(`Items ensured: ${result.items.length}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
