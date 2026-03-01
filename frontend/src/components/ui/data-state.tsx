import type { ReactNode } from 'react'

interface DataStateProps {
  isLoading?: boolean
  error?: string | null
  empty?: boolean
  emptyLabel?: string
  children: ReactNode
}

export const DataState = ({
  isLoading = false,
  error,
  empty = false,
  emptyLabel = 'No records found.',
  children,
}: DataStateProps) => {
  if (isLoading) {
    return <p className="rounded-xl border border-line bg-panelMuted p-4 text-sm text-textMuted">Loading...</p>
  }

  if (error) {
    return <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error}</p>
  }

  if (empty) {
    return <p className="rounded-xl border border-line bg-panelMuted p-4 text-sm text-textMuted">{emptyLabel}</p>
  }

  return <>{children}</>
}
