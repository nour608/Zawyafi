import Link from 'next/link'
import { ArrowRight, Calendar, CheckCircle2, ChevronDown, Info, Lock, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function KYCStepperPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 py-4">
      <div className="space-y-3 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gold">KYC Verification</p>
        <h1 className="font-heading text-4xl text-text">Verify your Identity</h1>
        <p className="mx-auto max-w-2xl text-sm text-textMuted md:text-base">
          To invest in GCC opportunities on Zawyafi, we need to verify your eligibility and compliance.
        </p>
      </div>

      <Card className="space-y-6">
        <div className="rounded-xl border border-line bg-panelMuted p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-textMuted">Step 1 of 3</p>
              <h2 className="mt-1 font-heading text-2xl text-text">Personal Details</h2>
            </div>
            <p className="text-2xl font-semibold text-signal">33%</p>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-signal bg-signal/10 p-2 text-center text-xs font-semibold text-signal">Personal</div>
            <div className="rounded-lg border border-line p-2 text-center text-xs text-textMuted">Documents</div>
            <div className="rounded-lg border border-line p-2 text-center text-xs text-textMuted">Review</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-textMuted">
            Legal First Name
            <Input placeholder="e.g. Abdullah" />
          </label>
          <label className="space-y-2 text-sm text-textMuted">
            Legal Last Name
            <Input placeholder="e.g. Al-Sayed" />
          </label>
          <label className="space-y-2 text-sm text-textMuted">
            Date of Birth
            <div className="relative">
              <Input placeholder="DD / MM / YYYY" className="pr-10" />
              <Calendar className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-textMuted" />
            </div>
          </label>
          <label className="space-y-2 text-sm text-textMuted">
            <span className="inline-flex items-center gap-1">
              Nationality <Info className="size-4" />
            </span>
            <div className="relative">
              <select className="min-h-11 w-full rounded-xl border border-line bg-panelMuted px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50">
                <option>Select nationality</option>
                <option>Saudi Arabia</option>
                <option>United Arab Emirates</option>
                <option>Qatar</option>
                <option>United States</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-textMuted" />
            </div>
          </label>

          <div className="space-y-2 md:col-span-2">
            <p className="text-sm text-textMuted">Current Residency Status</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <button className="rounded-xl border border-signal bg-signal/10 py-3 text-sm font-semibold text-signal">Citizen</button>
              <button className="rounded-xl border border-line bg-panelMuted py-3 text-sm text-textMuted">Permanent Resident</button>
              <button className="rounded-xl border border-line bg-panelMuted py-3 text-sm text-textMuted">Work Visa</button>
            </div>
          </div>

          <label className="space-y-2 text-sm text-textMuted md:col-span-2">
            Country of Residence
            <Input placeholder="Select country of residence" />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-2">
          <button className="text-sm text-textMuted transition-colors hover:text-text">Cancel Application</button>
          <Button variant="cc">
            Continue to Documents <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      </Card>

      <div className="space-y-2 text-center text-xs text-textMuted">
        <p className="inline-flex items-center gap-2">
          <Lock className="size-3.5 text-success" /> 256-bit SSL Encryption
          <span className="mx-2">•</span>
          <ShieldCheck className="size-3.5 text-success" /> GDPR Compliant
          <span className="mx-2">•</span>
          <CheckCircle2 className="size-3.5 text-success" /> Bank-grade infrastructure
        </p>
        <p>
          Your data is processed securely in compliance with GCC regulations.{' '}
          <Link href="#" className="underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </main>
  )
}
