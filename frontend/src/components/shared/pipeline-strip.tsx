import { Badge } from '@/components/ui/badge'

interface PipelineStripProps {
  backendState: 'ok' | 'degraded'
  latestStatus: 'VERIFIED' | 'UNVERIFIED' | null
}

export const PipelineStrip = ({ backendState, latestStatus }: PipelineStripProps) => (
  <div className="rounded-2xl border border-line bg-panel p-4">
    <div className="grid gap-4 md:grid-cols-4">
      <div className="space-y-2">
        <p className="text-xs text-textMuted">Square</p>
        <Badge tone={backendState === 'ok' ? 'success' : 'warning'} label={backendState === 'ok' ? 'Synced' : 'Degraded'} />
      </div>
      <div className="space-y-2">
        <p className="text-xs text-textMuted">Chainlink CRE</p>
        <Badge tone="signal" label="Active" />
      </div>
      <div className="space-y-2">
        <p className="text-xs text-textMuted">Onchain Registry</p>
        <Badge tone={latestStatus === 'VERIFIED' ? 'success' : latestStatus === 'UNVERIFIED' ? 'danger' : 'default'} label={latestStatus ?? 'No Data'} />
      </div>
      <div className="space-y-2">
        <p className="text-xs text-textMuted">Settlement Vault</p>
        <Badge tone="signal" label="Ready" />
      </div>
    </div>
  </div>
)
