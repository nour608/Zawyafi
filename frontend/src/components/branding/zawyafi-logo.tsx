import { cn } from '@/lib/utils'

interface ZawyafiLogoProps {
  className?: string
  variant?: 'wordmark' | 'mark'
}

export const ZawyafiLogo = ({ className, variant = 'wordmark' }: ZawyafiLogoProps) => {
  if (variant === 'mark') {
    return (
      <svg
        viewBox="0 0 40 40"
        className={cn('block', className)}
        role="img"
        aria-label="Zawyafi"
      >
        <text
          x="4"
          y="34"
          fontFamily="Syne, sans-serif"
          fontSize="36"
          fontWeight="600"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="1.8"
          strokeLinejoin="round"
        >
          Z
        </text>
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 290 40"
      className={cn('block', className)}
      role="img"
      aria-label="Zawyafi"
    >
      <text
        x="1"
        y="35"
        fontFamily="Syne, sans-serif"
        fontSize="38"
        fontWeight="600"
        fill="none"
        stroke="var(--gold)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      >
        Z
      </text>
      <text
        x="26"
        y="35"
        fontFamily="Syne, sans-serif"
        fontSize="38"
        fontWeight="600"
        fill="currentColor"
      >
        awyafi
      </text>
    </svg>
  )
}
