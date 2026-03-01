import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = ({ className, ...props }: InputProps) => (
  <input
    className={cn(
      'min-h-11 w-full rounded-xl border border-line bg-panelMuted px-3 text-sm text-text placeholder:text-textMuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50',
      className,
    )}
    {...props}
  />
)
