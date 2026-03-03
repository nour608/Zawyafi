import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildWalletAuthMessage,
  clearWalletAuthSession,
  getWalletAuthHeaders,
  type WalletAuthAccount,
} from '@/lib/api/wallet-auth'

describe('wallet-auth', () => {
  beforeEach(() => {
    clearWalletAuthSession()
  })

  it('builds deterministic auth message payload', () => {
    const message = buildWalletAuthMessage('0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD', '1234567890')
    expect(message).toContain('Zawyafi API Session')
    expect(message).toContain('address:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')
    expect(message).toContain('timestamp:1234567890')
  })

  it('reuses cached signed session headers for the same wallet', async () => {
    const signMessage = vi.fn(async () => '0xsignature')
    const account: WalletAuthAccount = {
      address: '0x1234567890abcdef1234567890abcdef12345678',
      signMessage,
    }

    const first = await getWalletAuthHeaders(account)
    const second = await getWalletAuthHeaders(account)

    expect(first['x-auth-address']).toBe('0x1234567890abcdef1234567890abcdef12345678')
    expect(first['x-auth-signature']).toBe('0xsignature')
    expect(second['x-auth-signature']).toBe('0xsignature')
    expect(signMessage).toHaveBeenCalledTimes(1)
  })
})

