'use client'

import { useState } from 'react'
import { prepareContractCall, readContract } from 'thirdweb'
import { useActiveAccount, useReadContract } from 'thirdweb/react'
import { isAddress, keccak256, stringToBytes } from 'viem'
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
import { listingStore, type ListingMeta } from '@/lib/listing-store'
import { type EnrichedBatch, useChainBatches } from '@/lib/web3/use-chain-batches'
import { contracts } from '@/lib/web3/contracts'

const FEATURE_IDENTITY_MUTATIONS = false

const hexToWorkflowName = (value: `0x${string}` | undefined): string => {
  if (!value || /^0x0+$/.test(value)) return 'Unset'
  try {
    return Buffer.from(value.slice(2), 'hex').toString('utf8').replace(/\u0000/g, '') || 'Unset'
  } catch {
    return value
  }
}

// ─── Listing Form ─────────────────────────────────────────────────────────

const EMPTY_META: Omit<ListingMeta, 'batchId'> = {
  title: '',
  description: '',
  imageUrl: '',
  sector: '',
  location: '',
}

const EMPTY_CATEGORY = { name: '', unitsForSale: '', unitCostUsdc: '' }

type CategoryInput = { name: string; unitsForSale: string; unitCostUsdc: string }

interface ListingFormProps {
  existingBatch?: EnrichedBatch
  onSuccess: () => void
  onCancel?: () => void
}

const USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
const USDC_DECIMALS = 6

const toUsdcMinor = (dollars: string) => {
  const parsed = parseFloat(dollars)
  if (!isFinite(parsed) || parsed <= 0) return null
  return BigInt(Math.round(parsed * 10 ** USDC_DECIMALS))
}

const ListingForm = ({ existingBatch, onSuccess, onCancel }: ListingFormProps) => {
  const isEdit = !!existingBatch
  const { capabilities } = useCapabilities()
  const account = useActiveAccount()
  const createAction = useTransactionAction()
  const pauseAction = useTransactionAction()
  const closeAction = useTransactionAction()
  const [metaSaveError, setMetaSaveError] = useState<string | null>(null)

  // Listing metadata fields
  const [meta, setMeta] = useState<Omit<ListingMeta, 'batchId'>>(() => {
    if (existingBatch?.meta) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { batchId: _batchId, ...rest } = existingBatch.meta
      return rest
    }
    return EMPTY_META
  })

  // On-chain fields — only used when creating
  const [merchantId, setMerchantId] = useState('')
  const [categories, setCategories] = useState<CategoryInput[]>([{ ...EMPTY_CATEGORY }])
  const [profitBps, setProfitBps] = useState('1000') // 10% default
  const [tokenName, setTokenName] = useState('')
  const [tokenSymbol, setTokenSymbol] = useState('')
  const [issuer, setIssuer] = useState('')
  const [founder, setFounder] = useState('')
  const [purchaseToken, setPurchaseToken] = useState(USDC_SEPOLIA)

  const updateMeta = (key: keyof typeof meta, value: string) =>
    setMeta((m) => ({ ...m, [key]: value }))

  const updateCategory = (i: number, key: keyof CategoryInput, value: string) =>
    setCategories((cats) => cats.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)))

  const addCategory = () => {
    if (categories.length < 3) setCategories((c) => [...c, { ...EMPTY_CATEGORY }])
  }

  const removeCategory = (i: number) => setCategories((cats) => cats.filter((_, idx) => idx !== i))

  // ── Save metadata only (edit mode) ──────────────────────────────────────
  const handleSaveMeta = async () => {
    if (!existingBatch || !account) return
    setMetaSaveError(null)
    try {
      const authAccount = {
        address: account.address,
        signMessage: async (input: unknown) => {
          if (typeof input === 'string') {
            return account.signMessage({ message: input })
          }
          if (typeof input === 'object' && input !== null && 'message' in input) {
            return account.signMessage({ message: (input as { message: string }).message })
          }
          throw new Error('Invalid signMessage input')
        }
      }
      await listingStore.set({ batchId: String(existingBatch.onChain.id), ...meta }, authAccount)
      onSuccess()
    } catch (err) {
      setMetaSaveError(err instanceof Error ? err.message : 'Failed to save metadata')
    }
  }

  // ── Create new batch ─────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!merchantId.trim()) return

    const merchantIdHash = keccak256(stringToBytes(merchantId.trim()))
    const categoryInputs = categories
      .map((c) => {
        const units = BigInt(parseInt(c.unitsForSale, 10) || 0)
        const cost = toUsdcMinor(c.unitCostUsdc)
        if (!c.name.trim() || units <= 0n || cost === null) return null
        return {
          categoryIdHash: keccak256(stringToBytes(c.name.trim())) as `0x${string}`,
          unitsForSale: units,
          unitCost: cost,
        }
      })
      .filter(Boolean)

    if (categoryInputs.length === 0) return

    const profitBpsNum = parseInt(profitBps, 10)
    if (!profitBpsNum || profitBpsNum <= 0 || profitBpsNum > 10000) return

    const tx = prepareContractCall({
      contract: contracts.factory,
      method:
        'function createBatch(bytes32 merchantIdHash, (bytes32 categoryIdHash, uint256 unitsForSale, uint256 unitCost)[] categories, address purchaseToken, uint16 profitBps, string tokenName, string tokenSymbol, address issuer, address founder) nonpayable returns (uint256 batchId)',
      params: [
        merchantIdHash as `0x${string}`,
        categoryInputs as { categoryIdHash: `0x${string}`; unitsForSale: bigint; unitCost: bigint }[],
        purchaseToken as `0x${string}`,
        profitBpsNum,
        tokenName,
        tokenSymbol,
        issuer as `0x${string}`,
        founder as `0x${string}`,
      ],
    })

    await createAction.run(tx)

    if (createAction.state === 'confirmed' && account) {
      // Read nextBatchId to find the newly created batchId (it's nextBatchId - 1)
      try {
        const nextId = await readContract({
          contract: contracts.factory,
          method: 'function nextBatchId() view returns (uint256)',
          params: [],
        })
        const newBatchId = String(Number(nextId) - 1)
        const authAccount = {
          address: account.address,
          signMessage: async (input: unknown) => {
            if (typeof input === 'string') {
              return account.signMessage({ message: input })
            }
            if (typeof input === 'object' && input !== null && 'message' in input) {
              return account.signMessage({ message: (input as { message: string }).message })
            }
            throw new Error('Invalid signMessage input')
          }
        }
        await listingStore.set({ batchId: newBatchId, ...meta }, authAccount)
      } catch {
        // Metadata save failed — batch is still on-chain, user can edit it after
      }
      onSuccess()
    }
  }

  // ── Admin batch controls (edit mode) ─────────────────────────────────────
  const handleToggleActive = async () => {
    if (!existingBatch) return
    await pauseAction.run(
      prepareContractCall({
        contract: contracts.factory,
        method: 'function setBatchActive(uint256 batchId, bool active) nonpayable',
        params: [existingBatch.onChain.id, !existingBatch.onChain.active],
      }),
    )
    onSuccess()
  }

  const handleCloseBatch = async () => {
    if (!existingBatch || existingBatch.onChain.closed) return
    await closeAction.run(
      prepareContractCall({
        contract: contracts.factory,
        method: 'function closeBatch(uint256 batchId) nonpayable',
        params: [existingBatch.onChain.id],
      }),
    )
    onSuccess()
  }

  return (
    <div className="space-y-5">
      {/* ── Listing Metadata ─────────────────────────────────────── */}
      <Card className="space-y-4">
        <h3 className="font-heading text-base font-semibold">
          {isEdit ? `Edit Listing #${existingBatch.onChain.id.toString()}` : 'New Listing Metadata'}
        </h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-textMuted">Title</span>
            <Input value={meta.title} onChange={(e) => updateMeta('title', e.target.value)} placeholder="Cairo Logistics Series A" />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-textMuted">Merchant ID</span>
            <Input
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              placeholder="merchant-1"
              disabled={isEdit}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-textMuted">Sector</span>
            <Input value={meta.sector} onChange={(e) => updateMeta('sector', e.target.value)} placeholder="Logistics" />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-textMuted">Location</span>
            <Input value={meta.location} onChange={(e) => updateMeta('location', e.target.value)} placeholder="Cairo, Egypt" />
          </label>
          <label className="col-span-full space-y-1">
            <span className="text-xs uppercase tracking-wide text-textMuted">Image URL</span>
            <Input value={meta.imageUrl} onChange={(e) => updateMeta('imageUrl', e.target.value)} placeholder="https://..." />
          </label>
          <label className="col-span-full space-y-1">
            <span className="text-xs uppercase tracking-wide text-textMuted">Description</span>
            <textarea
              value={meta.description}
              onChange={(e) => updateMeta('description', e.target.value)}
              rows={3}
              placeholder="Investment opportunity details..."
              className="w-full resize-none rounded-lg border border-line bg-panelMuted px-3 py-2 text-sm text-text placeholder:text-textMuted focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
          </label>
        </div>

        {isEdit ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveMeta}>Save Listing Info</Button>
              {onCancel && (
                <Button variant="secondary" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
            {metaSaveError && (
              <p className="text-sm text-red-400">{metaSaveError}</p>
            )}
          </div>
        ) : null}
      </Card>

      {/* ── On-chain Fields (create only) ────────────────────────── */}
      {!isEdit && (
        <>
          <Card className="space-y-4">
            <h3 className="font-heading text-base font-semibold">On-chain Parameters</h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-textMuted">Token Name</span>
                <Input value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="Cairo Batch Token" />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-textMuted">Token Symbol</span>
                <Input value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value)} placeholder="CBT" />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-textMuted">Profit (bps, 100 = 1%)</span>
                <Input type="number" value={profitBps} onChange={(e) => setProfitBps(e.target.value)} placeholder="1000" />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-textMuted">Purchase Token Address</span>
                <Input value={purchaseToken} onChange={(e) => setPurchaseToken(e.target.value)} placeholder="0x..." />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-textMuted">Issuer Address</span>
                <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="0x..." />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-textMuted">Founder Address</span>
                <Input value={founder} onChange={(e) => setFounder(e.target.value)} placeholder="0x..." />
              </label>
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base font-semibold">Categories (max 3)</h3>
              <Button variant="secondary" onClick={addCategory} disabled={categories.length >= 3}>
                + Add Category
              </Button>
            </div>

            {categories.map((cat, i) => (
              <div key={i} className="grid gap-3 rounded-lg border border-line bg-panelMuted p-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-wide text-textMuted">Category Name</span>
                  <Input value={cat.name} onChange={(e) => updateCategory(i, 'name', e.target.value)} placeholder="Electronics" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-wide text-textMuted">Units for Sale</span>
                  <Input
                    type="number"
                    value={cat.unitsForSale}
                    onChange={(e) => updateCategory(i, 'unitsForSale', e.target.value)}
                    placeholder="1000"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-wide text-textMuted">Unit Cost (USDC)</span>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={cat.unitCostUsdc}
                      onChange={(e) => updateCategory(i, 'unitCostUsdc', e.target.value)}
                      placeholder="100"
                    />
                    {categories.length > 1 && (
                      <Button variant="secondary" onClick={() => removeCategory(i)}>
                        ✕
                      </Button>
                    )}
                  </div>
                </label>
              </div>
            ))}

            <Button
              variant="cc"
              onClick={handleCreate}
              disabled={createAction.state === 'pending' || createAction.state === 'signing'}
            >
              {createAction.state === 'pending' || createAction.state === 'signing' ? 'Creating...' : 'Create Batch On-chain'}
            </Button>
            <TxStatus state={createAction.state} hash={createAction.transactionHash} error={createAction.error} />
          </Card>
        </>
      )}

      {/* ── Admin Controls (edit mode) ───────────────────────────── */}
      {isEdit && capabilities.canUseAdmin && (
        <Card className="space-y-3">
          <h3 className="font-heading text-base font-semibold">On-chain Controls</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={handleToggleActive}
              disabled={existingBatch.onChain.closed || pauseAction.state === 'pending'}
            >
              {existingBatch.onChain.active ? 'Pause Batch' : 'Activate Batch'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleCloseBatch}
              disabled={existingBatch.onChain.closed || closeAction.state === 'pending'}
            >
              Close Batch (Irreversible)
            </Button>
          </div>
          <TxStatus state={pauseAction.state} hash={pauseAction.transactionHash} error={pauseAction.error} />
          <TxStatus state={closeAction.state} hash={closeAction.transactionHash} error={closeAction.error} />
        </Card>
      )}
    </div>
  )
}

// ─── Batch Row ────────────────────────────────────────────────────────────

const BatchRow = ({ batch, onEdit }: { batch: EnrichedBatch; onEdit: () => void; onSuccess: () => void }) => {
  const { onChain, meta } = batch
  const progress = onChain.totalUnitsForSale > 0n
    ? Number((onChain.totalUnitsSold * 100n) / onChain.totalUnitsForSale)
    : 0

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-panelMuted p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-text">#{onChain.id.toString()}</span>
          {meta?.title && <span className="text-sm text-textMuted">{meta.title}</span>}
          <Badge
            tone={onChain.closed ? 'warning' : onChain.active ? 'success' : 'signal'}
            label={onChain.closed ? 'Closed' : onChain.active ? 'Active' : 'Paused'}
          />
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-textMuted">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-panelMuted border border-line">
            <div className="h-full rounded-full bg-teal" style={{ width: `${progress}%` }} />
          </div>
          <span>{progress}% sold</span>
          <span>·</span>
          <span>{onChain.totalUnitsSold.toString()} / {onChain.totalUnitsForSale.toString()} units</span>
          {meta?.sector && <><span>·</span><span>{meta.sector}</span></>}
        </div>
      </div>
      <Button variant="secondary" onClick={onEdit} className="shrink-0">
        Edit
      </Button>
    </div>
  )
}

// ─── Oracle Controls ──────────────────────────────────────────────────────

const OracleControls = () => {
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
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const expectedAuthorQuery = useReadContract({
    contract: contracts.oracleCoordinator,
    method: 'function getExpectedAuthor() view returns (address)',
  })
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const workflowIdQuery = useReadContract({
    contract: contracts.oracleCoordinator,
    method: 'function getExpectedWorkflowId() view returns (bytes32)',
  })
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const workflowNameQuery = useReadContract({
    contract: contracts.oracleCoordinator,
    method: 'function getExpectedWorkflowName() view returns (bytes10)',
  })

  return (
    <>
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Oracle Trust Configuration</h2>
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
            <p className="mt-1 break-all">{hexToWorkflowName(workflowNameQuery.data as `0x${string}` | undefined)}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="space-y-3">
          <h3 className="font-heading text-base font-semibold">Set Expected Author</h3>
          <Input value={expectedAuthor} onChange={(e) => setExpectedAuthor(e.target.value)} placeholder="0x..." />
          <Button onClick={async () => {
            if (!isAddress(expectedAuthor)) return
            await authorAction.run(prepareContractCall({
              contract: contracts.oracleCoordinator,
              method: 'function setExpectedAuthor(address expectedAuthor)',
              params: [expectedAuthor as `0x${string}`],
            }))
          }} disabled={!isAddress(expectedAuthor)}>Set Author</Button>
          <TxStatus state={authorAction.state} hash={authorAction.transactionHash} error={authorAction.error} />
        </Card>

        <Card className="space-y-3">
          <h3 className="font-heading text-base font-semibold">Set Workflow ID</h3>
          <Input value={expectedWorkflowId} onChange={(e) => setExpectedWorkflowId(e.target.value)} placeholder="0x...32-bytes" />
          <Button variant="secondary" onClick={async () => {
            await workflowIdAction.run(prepareContractCall({
              contract: contracts.oracleCoordinator,
              method: 'function setExpectedWorkflowId(bytes32 workflowId)',
              params: [expectedWorkflowId as `0x${string}`],
            }))
          }}>Set Workflow ID</Button>
          <TxStatus state={workflowIdAction.state} hash={workflowIdAction.transactionHash} error={workflowIdAction.error} />
        </Card>

        <Card className="space-y-3">
          <h3 className="font-heading text-base font-semibold">Set Workflow Name</h3>
          <Input value={expectedWorkflowName} onChange={(e) => setExpectedWorkflowName(e.target.value)} placeholder="Workflow name" />
          <Button variant="secondary" onClick={async () => {
            await workflowNameAction.run(prepareContractCall({
              contract: contracts.oracleCoordinator,
              method: 'function setExpectedWorkflowName(string workflowName)',
              params: [expectedWorkflowName],
            }))
          }}>Set Workflow Name</Button>
          <TxStatus state={workflowNameAction.state} hash={workflowNameAction.transactionHash} error={workflowNameAction.error} />
        </Card>
      </div>
    </>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────

type AdminView = 'list' | 'create' | { edit: EnrichedBatch }

export const AdminDashboard = () => {
  const { capabilities, isConnected } = useCapabilities()
  const { batches, isLoading, error, refetch } = useChainBatches()
  const [view, setView] = useState<AdminView>('list')

  const handleSuccess = () => {
    refetch()
    setView('list')
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        subtitle="Create and manage investment listings, control batch status, and configure oracle trust parameters."
      />

      <ComplianceOperationsPanel />

      {/* ── Listings Panel ─────────────────────────────────────── */}
      <CapabilityGate
        enabled={capabilities.canUseAdmin && isConnected}
        blockedLabel="Connect an allowlisted admin wallet to manage listings."
      >
        {view === 'list' && (
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">Investment Listings</h2>
              <Button variant="cc" onClick={() => setView('create')}>+ Create New Listing</Button>
            </div>

            {isLoading && <p className="text-sm text-textMuted">Loading batches from chain…</p>}
            {error && <p className="text-sm text-red-400">{error}</p>}
            {!isLoading && !error && batches.length === 0 && (
              <p className="text-sm text-textMuted">No batches found on-chain yet. Create the first one above.</p>
            )}
            <div className="space-y-3">
              {batches.map((b) => (
                <BatchRow
                  key={b.onChain.id.toString()}
                  batch={b}
                  onEdit={() => setView({ edit: b })}
                  onSuccess={handleSuccess}
                />
              ))}
            </div>
          </Card>
        )}

        {view === 'create' && (
          <div className="space-y-4">
            <button onClick={() => setView('list')} className="text-sm text-textMuted hover:text-text">
              ← Back to listings
            </button>
            <ListingForm onSuccess={handleSuccess} onCancel={() => setView('list')} />
          </div>
        )}

        {typeof view === 'object' && 'edit' in view && (
          <div className="space-y-4">
            <button onClick={() => setView('list')} className="text-sm text-textMuted hover:text-text">
              ← Back to listings
            </button>
            <ListingForm existingBatch={view.edit} onSuccess={handleSuccess} onCancel={() => setView('list')} />
          </div>
        )}
      </CapabilityGate>

      {/* ── Oracle Controls ────────────────────────────────────── */}
      <CapabilityGate
        enabled={capabilities.canUseAdmin && isConnected}
        blockedLabel="Connect an allowlisted admin wallet to execute protected workflow trust mutations."
      >
        <OracleControls />
      </CapabilityGate>

      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold">Identity and Compliance Utilities</h3>
          <Badge tone={FEATURE_IDENTITY_MUTATIONS ? 'signal' : 'warning'} label={FEATURE_IDENTITY_MUTATIONS ? 'Enabled' : 'Phase-Gated'} />
        </div>
        <p className="mt-3 text-sm text-textMuted">
          Wallet whitelist, freeze, and blacklist mutation controls are intentionally phase-gated. Keep this disabled during demo mode
          unless governance safeguards are ready.
        </p>
      </Card>
    </main>
  )
}
