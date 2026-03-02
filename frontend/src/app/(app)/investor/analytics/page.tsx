import { InvestorConnectGate } from '@/components/shared/investor-connect-gate'
import { Card } from '@/components/ui/card'

export default function InvestorAnalyticsPage() {
  return (
    <InvestorConnectGate
      title="Connect to access investor analytics"
      description="Investor analytics are available only after wallet login."
    >
      <main className="space-y-6">
        <Card className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-gold">Investor Analytics</p>
          <h1 className="font-heading text-3xl text-text">Analytics</h1>
          <p className="max-w-2xl text-sm text-textMuted md:text-base">
            Analytics dashboard is coming soon. This section will include yield curves, exposure heatmaps, and risk trend overlays.
          </p>
        </Card>
      </main>
    </InvestorConnectGate>
  )
}
