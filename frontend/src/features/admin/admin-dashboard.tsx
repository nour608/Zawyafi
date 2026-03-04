'use client'

import { useState } from 'react'
import { prepareContractCall } from 'thirdweb'
import { useReadContract } from 'thirdweb/react'
import { hexToString, isAddress } from 'viem'
import { PageHeader } from '@/components/layout/page-header'
import { CapabilityGate } from '@/components/shared/capability-gate'
import { TxStatus } from '@/components/shared/tx-status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ComplianceOperationsPanel } from '@/features/compliance/compliance-operations-panel'
import { useTransactionAction } from '@/features/transactions/use-transaction-action'
import { useCapabilities } from '@/hooks/use-capabilities'
import { contracts } from '@/lib/web3/contracts'

const FEATURE_IDENTITY_MUTATIONS = false

const decodeWorkflowName = (value: `0x${string}` | undefined): string => {
  if (!value || /^0x0+$/.test(value)) {
    return 'Unset'
  }

  try {
    return hexToString(value, { size: 10 }).replace(/\u0000/g, '') || 'Unset'
  } catch {
    return value
  }
}

export const AdminDashboard = () => {
  const { capabilities, isConnected } = useCapabilities()

  const [expectedAuthor, setExpectedAuthor] = useState('')
  const [expectedWorkflowId, setExpectedWorkflowId] = useState('0x')
  const [expectedWorkflowName, setExpectedWorkflowName] = useState('ZawyafiOracle')

  const authorAction = useTransactionAction()
  const workflowIdAction = useTransactionAction()
  const workflowNameAction = useTransactionAction()

  const forwarderQuery = useReadContract({
    contract: contracts.oracleCoordinator,
    method: 'function getForwarderAddress() view returns (address)',
  })
  const expectedAuthorQuery = useReadContract({
    contract: contracts.oracleCoordinator,
    method: 'function getExpectedAuthor() view returns (address)',
  })
  const workflowIdQuery = useReadContract({
    contract: contracts.oracleCoordinator,
    method: 'function getExpectedWorkflowId() view returns (bytes32)',
  })
  const workflowNameQuery = useReadContract({
    contract: contracts.oracleCoordinator,
    method: 'function getExpectedWorkflowName() view returns (bytes10)',
  })

  const handleSetAuthor = async (): Promise<void> => {
    if (!isAddress(expectedAuthor)) {
      return
    }

    await authorAction.run(
      prepareContractCall({
        contract: contracts.oracleCoordinator,
        method: 'function setExpectedAuthor(address expectedAuthor)',
        params: [expectedAuthor as `0x${string}`],
      }),
    )
  }

  const handleSetWorkflowId = async (): Promise<void> => {
    await workflowIdAction.run(
      prepareContractCall({
        contract: contracts.oracleCoordinator,
        method: 'function setExpectedWorkflowId(bytes32 workflowId)',
        params: [expectedWorkflowId as `0x${string}`],
      }),
    )
  }

  const handleSetWorkflowName = async (): Promise<void> => {
    await workflowNameAction.run(
      prepareContractCall({
        contract: contracts.oracleCoordinator,
        method: 'function setExpectedWorkflowName(string workflowName)',
        params: [expectedWorkflowName],
      }),
    )
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Admin and Trust Controls"
        subtitle="Inspect and adjust workflow trust metadata enforced by OracleCoordinator guardrails."
      />

      <ComplianceOperationsPanel />

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Current Trust Configuration</h2>
          <Badge tone="signal" label="Onchain" />
        </div>

        <div className="mt-4 grid gap-3 text-sm text-textMuted md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide">Forwarder</p>
            <p className="mt-1 break-all">{forwarderQuery.data ?? 'Loading...'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide">Expected Author</p>
            <p className="mt-1 break-all">{expectedAuthorQuery.data ?? 'Loading...'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide">Expected Workflow Id</p>
            <p className="mt-1 break-all">{workflowIdQuery.data ?? 'Loading...'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide">Expected Workflow Name</p>
            <p className="mt-1 break-all">{decodeWorkflowName(workflowNameQuery.data as `0x${string}` | undefined)}</p>
          </div>
        </div>
      </Card>

      <CapabilityGate
        enabled={capabilities.canUseAdmin && isConnected}
        blockedLabel="Connect an allowlisted admin wallet to execute protected workflow trust mutations."
      >
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="space-y-3">
            <h3 className="font-heading text-base font-semibold">Set Expected Author</h3>
            <Input value={expectedAuthor} onChange={(event) => setExpectedAuthor(event.target.value)} placeholder="0x..." />
            <Button onClick={handleSetAuthor} disabled={!isAddress(expectedAuthor)}>
              Set Author
            </Button>
            <TxStatus state={authorAction.state} hash={authorAction.transactionHash} error={authorAction.error} />
          </Card>

          <Card className="space-y-3">
            <h3 className="font-heading text-base font-semibold">Set Workflow ID</h3>
            <Input value={expectedWorkflowId} onChange={(event) => setExpectedWorkflowId(event.target.value)} placeholder="0x...32-bytes" />
            <Button variant="secondary" onClick={handleSetWorkflowId}>
              Set Workflow ID
            </Button>
            <TxStatus state={workflowIdAction.state} hash={workflowIdAction.transactionHash} error={workflowIdAction.error} />
          </Card>

          <Card className="space-y-3">
            <h3 className="font-heading text-base font-semibold">Set Workflow Name</h3>
            <Input value={expectedWorkflowName} onChange={(event) => setExpectedWorkflowName(event.target.value)} placeholder="Workflow name" />
            <Button variant="secondary" onClick={handleSetWorkflowName}>
              Set Workflow Name
            </Button>
            <TxStatus state={workflowNameAction.state} hash={workflowNameAction.transactionHash} error={workflowNameAction.error} />
          </Card>
        </div>
      </CapabilityGate>

      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold">Identity and Compliance Utilities</h3>
          <Badge tone={FEATURE_IDENTITY_MUTATIONS ? 'signal' : 'warning'} label={FEATURE_IDENTITY_MUTATIONS ? 'Enabled' : 'Phase-Gated'} />
        </div>
        <p className="mt-3 text-sm text-textMuted">
          Wallet whitelist, freeze, and blacklist mutation controls are intentionally phase-gated. Keep this disabled during demo mode unless governance safeguards are ready.
        </p>
      </Card>
    </main>
  )
}
