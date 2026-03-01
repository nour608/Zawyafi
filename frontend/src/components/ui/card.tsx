import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

type CardVariant = 'dark' | 'light'

interface CardProps {
  className?: string
  children: ReactNode
  variant?: CardVariant
}

const variantStyles: Record<CardVariant, string> = {
  dark: 'rounded-2xl border border-line bg-panel p-5 shadow-[0_2px_8px_rgba(26,26,46,0.06),inset_0_1px_0_rgba(255,255,255,0.4)] backdrop-blur',
  light: 'cc-card p-5',
}

export const Card = ({ className, children, variant = 'dark' }: CardProps) => (
  <section className={cn(variantStyles[variant], className)}>{children}</section>
)
