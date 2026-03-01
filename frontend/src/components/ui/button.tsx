import React, { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'cc' | 'cc-outline'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

const variantMap: Record<ButtonVariant, string> = {
  primary:
    'bg-[#161733] text-[#f5f2eb] hover:brightness-110 dark:bg-[linear-gradient(135deg,#c9a84c,#e8c97a)] dark:text-[#0a0c10] disabled:opacity-55',
  secondary:
    'bg-panel text-text hover:bg-panelMuted border border-line disabled:text-textMuted disabled:opacity-60',
  ghost: 'bg-transparent text-text hover:bg-panelMuted/80 border border-transparent disabled:opacity-60',
  danger: 'bg-danger text-canvas hover:bg-danger/90 disabled:opacity-60',
  cc: 'bg-[#161733] text-[#f5f2eb] hover:brightness-110 [clip-path:polygon(9px_0%,100%_0%,calc(100%-9px)_100%,0_100%)] dark:bg-[linear-gradient(135deg,#c9a84c,#e8c97a)] dark:text-[#0a0c10]',
  'cc-outline':
    'bg-transparent text-cc-text border border-cc-border hover:border-gold hover:text-gold [clip-path:polygon(9px_0%,100%_0%,calc(100%-9px)_100%,0_100%)]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center justify-center px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed',
        variant !== 'cc' && variant !== 'cc-outline' && 'rounded-xl focus-visible:ring-offset-canvas',
        variantMap[variant],
        className,
      )}
      {...props}
    />
  )
})
