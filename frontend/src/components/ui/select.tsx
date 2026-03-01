import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export const Select = ({ className, children, ...props }: SelectProps) => (
  <select
    className={cn(
      'min-h-11 w-full rounded-xl border border-line bg-panelMuted px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50',
      className,
    )}
    {...props}
  >
    {children}
  </select>
)
