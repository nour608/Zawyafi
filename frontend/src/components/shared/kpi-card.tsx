import { ArrowUpRight } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface KpiCardProps {
  label: string
  value: string
  hint?: string
}

export const KpiCard = ({ label, value, hint }: KpiCardProps) => (
  <Card className="space-y-3">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-textMuted">{label}</p>
    <div className="flex items-center justify-between gap-3">
      <p className="font-heading text-2xl font-semibold text-text">{value}</p>
      <ArrowUpRight className="size-4 text-signal" aria-hidden="true" />
    </div>
    {hint ? <p className="text-xs text-textMuted">{hint}</p> : null}
  </Card>
)
