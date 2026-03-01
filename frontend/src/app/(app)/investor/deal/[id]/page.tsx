import Link from 'next/link'
import { ArrowLeft, ArrowRight, Download, MapPin, ShieldCheck, TrendingUp, Truck, Verified } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function DealDetailsPage() {
  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/investor/marketplace" className="inline-flex items-center gap-2 text-sm text-textMuted transition-colors hover:text-text">
          <ArrowLeft className="size-4" /> Back to marketplace
        </Link>
        <Badge tone="success" label="Live Round" />
      </div>

      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">Falcon Logistics</p>
            <h1 className="mt-2 font-heading text-3xl text-text md:text-4xl">Series A Deal Overview</h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-textMuted">
              <span className="inline-flex items-center gap-1.5">
                <Truck className="size-4" /> Logistics & Supply Chain
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" /> Dubai, UAE
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Verified className="size-4" /> Verified Partner
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-line bg-panelMuted p-4 text-right">
            <p className="text-xs uppercase tracking-[0.14em] text-textMuted">Funding Progress</p>
            <p className="mt-1 text-2xl font-semibold text-text">70%</p>
          </div>
        </div>

        <p className="max-w-4xl text-sm leading-relaxed text-textMuted md:text-base">
          Falcon Logistics is expanding last-mile infrastructure across GCC markets with AI routing and onchain settlement reporting.
          This round targets growth in UAE and KSA operations with tokenized equity access.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-textMuted">Valuation Cap</p>
          <p className="text-2xl font-semibold text-text">$45M</p>
          <p className="inline-flex items-center gap-1 text-xs text-success">
            <TrendingUp className="size-3.5" /> +15% vs Seed
          </p>
        </Card>
        <Card className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-textMuted">Min Ticket</p>
          <p className="text-2xl font-semibold text-text">$1,000</p>
          <p className="text-xs text-textMuted">USDC / USDT</p>
        </Card>
        <Card className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-textMuted">Token Standard</p>
          <p className="text-2xl font-semibold text-text">ERC-1400</p>
          <p className="text-xs text-textMuted">Security token issuance</p>
        </Card>
      </div>

      <Card className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">Compliance & Eligibility</h2>
        <div className="flex flex-wrap gap-2">
          <Badge tone="warning" label="KYC Level 2 Required" />
          <Badge tone="warning" label="Reg D (506c)" />
          <Badge tone="warning" label="12-Month Lock-up" />
        </div>
        <p className="text-sm text-textMuted">
          This offering is available to accredited investors and qualified international investors. Transfer restrictions apply during lock-up.
        </p>
        <Button variant="secondary" className="w-full sm:w-auto">
          <Download className="mr-2 size-4" /> Download Prospectus
        </Button>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">Invest Now</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-line bg-panelMuted p-3 text-center text-xs text-textMuted">1. Connect Wallet</div>
          <div className="rounded-xl border border-line bg-panelMuted p-3 text-center text-xs text-textMuted">2. Complete KYC</div>
          <div className="rounded-xl border border-gold bg-gold/10 p-3 text-center text-xs font-semibold text-gold">3. Commit Investment</div>
        </div>
        <div className="rounded-xl border border-line bg-panelMuted p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-textMuted">Target Raise</p>
          <p className="mt-1 text-xl font-semibold text-text">$5,000,000</p>
        </div>
        <Button variant="cc" className="w-full">
          Commit Investment <ArrowRight className="ml-2 size-4" />
        </Button>
      </Card>

      <div className="rounded-xl border border-line bg-panelMuted p-4 text-sm text-textMuted">
        <p className="inline-flex items-center gap-2 font-semibold text-text">
          <ShieldCheck className="size-4 text-success" /> Regulatory Compliant
        </p>
        <p className="mt-2">This issuance follows DIFC innovation framework guidelines with audited contract infrastructure.</p>
      </div>
    </main>
  )
}
