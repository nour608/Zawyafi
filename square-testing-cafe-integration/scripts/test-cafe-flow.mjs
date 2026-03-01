import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const loadDotEnv = () => {
  const currentFile = fileURLToPath(import.meta.url)
  const scriptsDir = path.dirname(currentFile)
  const envPath = path.resolve(scriptsDir, '..', '.env')

  if (!fs.existsSync(envPath)) {
    return
  }

  const content = fs.readFileSync(envPath, 'utf8')
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

loadDotEnv()

const mustGetEnv = (name) => {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`)
  }

  return value
}

const getEnv = (name, fallback) => {
  const value = process.env[name]
  if (value === undefined || value.trim().length === 0) {
    return fallback
  }

  return value
}

const requestJson = async (input) => {
  let response
  try {
    response = await fetch(input.url, {
      method: input.method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
    })
  } catch (error) {
    throw new Error(
      `Network error calling ${input.url}. Ensure backend is running at BACKEND_BASE_URL (default http://127.0.0.1:3001). Original error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  const text = await response.text()
  const json = text.length > 0 ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new Error(`Request failed ${input.method} ${input.url}: ${response.status} ${JSON.stringify(json)}`)
  }

  return json
}

const sumMinor = (values) => {
  return values.reduce((acc, item) => acc + BigInt(item.amountMinor), 0n)
}

const formatMinor = (amount) => {
  const sign = amount < 0n ? '-' : ''
  const absolute = amount < 0n ? -amount : amount
  const whole = absolute / 100n
  const fraction = (absolute % 100n).toString().padStart(2, '0')
  return `${sign}${whole.toString()}.${fraction}`
}

const main = async () => {
  const backendBaseUrl = getEnv('BACKEND_BASE_URL', 'http://127.0.0.1:3001')
  const merchantId = mustGetEnv('TEST_MERCHANT_ID')
  const date = getEnv('TEST_DATE', new Date().toISOString().slice(0, 10))

  console.log(`Testing cafe flow against ${backendBaseUrl}`)
  console.log(`merchantId=${merchantId}, date=${date}`)

  const payments = await requestJson({
    method: 'GET',
    url: `${backendBaseUrl}/square/payments/daily?merchantId=${encodeURIComponent(merchantId)}&date=${date}`,
  })

  const refunds = await requestJson({
    method: 'GET',
    url: `${backendBaseUrl}/square/refunds/daily?merchantId=${encodeURIComponent(merchantId)}&date=${date}`,
  })

  const gross = sumMinor(payments.payments)
  const refunded = sumMinor(refunds.refunds)
  const net = gross - refunded

  console.log('---')
  console.log('Source: live Square API')
  console.log(`Payments count: ${payments.count}`)
  console.log(`Refunds count: ${refunds.count}`)
  console.log(`Gross (minor): ${gross.toString()}`)
  console.log(`Refunds (minor): ${refunded.toString()}`)
  console.log(`Net (minor): ${net.toString()}`)
  console.log(`Gross (formatted): ${formatMinor(gross)}`)
  console.log(`Refunds (formatted): ${formatMinor(refunded)}`)
  console.log(`Net (formatted): ${formatMinor(net)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
