import { InvestorConnectGate } from '@/components/shared/investor-connect-gate'
import { Card } from '@/components/ui/card'
import { WalletChip } from '@/components/shared/wallet-chip'

export default function InvestorWalletPage() {
  return (
    <InvestorConnectGate
      title="Connect to access wallet center"
      description="Wallet balances, permissions, and payout history are hidden until you connect."
    >
      <main className="space-y-6">
        <Card className="space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-gold">Wallet Center</p>
          <h1 className="font-heading text-3xl text-text">Wallet</h1>
          <p className="max-w-2xl text-sm text-textMuted md:text-base">
            Connect your wallet to review balances, permissions, and payout history. Detailed wallet analytics are coming soon.
          </p>
          <WalletChip />
        </Card>
      </main>
    </InvestorConnectGate>
  )
}
