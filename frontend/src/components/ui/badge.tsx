import { cn } from '@/lib/utils/cn'

type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'signal'

interface BadgeProps {
  tone?: BadgeTone
  label: string
}

const toneMap: Record<BadgeTone, string> = {
  default: 'bg-panelMuted text-textMuted border border-line',
  success: 'bg-success/15 text-success border border-success/25',
  warning: 'bg-warning/15 text-warning border border-warning/25',
  danger: 'bg-danger/15 text-danger border border-danger/25',
  signal: 'bg-signal/15 text-signal border border-signal/20',
}

export const Badge = ({ tone = 'default', label }: BadgeProps) => (
  <span className={cn('inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold', toneMap[tone])}>{label}</span>
)
