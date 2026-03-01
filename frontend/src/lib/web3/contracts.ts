import { getContract } from 'thirdweb'
import { sepolia } from 'thirdweb/chains'
import { env } from '@/lib/env'
import { thirdwebClient } from '@/lib/web3/client'

export const contracts = {
  factory: getContract({
    client: thirdwebClient,
    chain: sepolia,
    address: env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}`,
  }),
  settlementVault: getContract({
    client: thirdwebClient,
    chain: sepolia,
    address: env.NEXT_PUBLIC_SETTLEMENT_VAULT_ADDRESS as `0x${string}`,
  }),
  revenueRegistry: getContract({
    client: thirdwebClient,
    chain: sepolia,
    address: env.NEXT_PUBLIC_REVENUE_REGISTRY_ADDRESS as `0x${string}`,
  }),
  oracleCoordinator: getContract({
    client: thirdwebClient,
    chain: sepolia,
    address: env.NEXT_PUBLIC_ORACLE_COORDINATOR_ADDRESS as `0x${string}`,
  }),
}
