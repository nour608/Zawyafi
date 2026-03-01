import { Badge } from '@/components/ui/badge'
import type { TxLifecycleState } from '@/lib/types/frontend'

interface TxStatusProps {
  state: TxLifecycleState
  hash?: string
  error?: string | null
}

export const TxStatus = ({ state, hash, error }: TxStatusProps) => {
  if (state === 'idle') {
    return <p className="text-xs text-textMuted">Ready to sign.</p>
  }

  if (state === 'signing') {
    return <Badge tone="signal" label="Awaiting Signature" />
  }

  if (state === 'pending') {
    return (
      <div className="space-y-1">
        <Badge tone="warning" label="Pending Confirmation" />
        {hash ? <p className="text-xs text-textMuted break-all">{hash}</p> : null}
      </div>
    )
  }

  if (state === 'confirmed') {
    return (
      <div className="space-y-1">
        <Badge tone="success" label="Confirmed" />
        {hash ? <p className="text-xs text-textMuted break-all">{hash}</p> : null}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <Badge tone="danger" label="Failed" />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  )
}
