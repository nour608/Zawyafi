import { cn } from '@/lib/utils/cn'

interface SkeletonProps {
  className?: string
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div className={cn('animate-pulse rounded-lg bg-panelMuted/80', className)} aria-hidden="true" />
)
