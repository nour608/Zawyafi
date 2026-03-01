import { History, ShieldCheck, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function TradingTerminalPage() {
  return (
    <main className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">Trading Terminal</p>
            <h1 className="mt-2 font-heading text-3xl text-text">TSG / USDC</h1>
            <p className="mt-2 text-sm text-textMuted">Private Equity Token • Series A • Onchain settlement</p>
          </div>
          <Badge tone="success" label="Market Open" />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-line bg-panelMuted p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-textMuted">Last Price</p>
            <p className="mt-1 text-2xl font-semibold text-text">$1.25</p>
          </div>
          <div className="rounded-xl border border-line bg-panelMuted p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-textMuted">24h Change</p>
            <p className="mt-1 inline-flex items-center gap-1 text-2xl font-semibold text-success">
              <TrendingUp className="size-5" /> +4.2%
            </p>
          </div>
          <div className="rounded-xl border border-line bg-panelMuted p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-textMuted">24h Volume</p>
            <p className="mt-1 text-2xl font-semibold text-text">452K TSG</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="space-y-4 xl:col-span-2">
          <h2 className="font-heading text-lg font-semibold">Order Book Snapshot</h2>
          <div className="grid grid-cols-3 border-b border-line pb-2 text-xs uppercase tracking-[0.12em] text-textMuted">
            <span>Price</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Total</span>
          </div>
          {[
            ['1.28', '500', '640.00'],
            ['1.27', '2,450', '3,111.50'],
            ['1.26', '12,500', '15,750.00'],
            ['1.25', '1,500', '1,875.00'],
            ['1.24', '500', '620.00'],
          ].map(([price, amount, total]) => (
            <div key={`${price}-${amount}`} className="grid grid-cols-3 py-1.5 text-sm text-textMuted">
              <span className="font-mono text-text">{price}</span>
              <span className="text-right font-mono">{amount}</span>
              <span className="text-right font-mono">{total}</span>
            </div>
          ))}
        </Card>

        <Card className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">Place Order</h2>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary">Buy</Button>
            <Button variant="ghost">Sell</Button>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.12em] text-textMuted">Price (USDC)</label>
            <Input defaultValue="1.25" />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.12em] text-textMuted">Amount (TSG)</label>
            <Input placeholder="0.00" />
          </div>
          <div className="rounded-xl border border-line bg-panelMuted p-3 text-sm text-textMuted">
            <p className="flex items-center justify-between">
              <span>Trading Fee</span>
              <span className="font-mono">0.125 USDC</span>
            </p>
            <p className="mt-2 flex items-center justify-between font-semibold text-text">
              <span>Total Cost</span>
              <span className="font-mono">0.00 USDC</span>
            </p>
          </div>
          <Button variant="cc" className="w-full">
            Buy TSG
          </Button>
        </Card>
      </div>

      <Card className="space-y-3">
        <h3 className="inline-flex items-center gap-2 font-heading text-base font-semibold">
          <History className="size-4" /> Open Orders
        </h3>
        <div className="grid gap-2 text-sm text-textMuted">
          <div className="flex items-center justify-between rounded-lg border border-line bg-panelMuted px-3 py-2">
            <span>Buy @ 1.24</span>
            <span>0% filled</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-line bg-panelMuted px-3 py-2">
            <span>Sell @ 1.30</span>
            <span>25% filled</span>
          </div>
        </div>
      </Card>

      <div className="rounded-xl border border-line bg-panelMuted p-4 text-sm text-textMuted">
        <p className="inline-flex items-center gap-2 font-semibold text-text">
          <ShieldCheck className="size-4 text-success" /> Verify Account
        </p>
        <p className="mt-2">KYC is required to trade private market tokens on this venue.</p>
      </div>
    </main>
  )
}
