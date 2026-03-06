'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'

export const TestnetBanner = () => {
    const [dismissed, setDismissed] = useState(false)

    if (dismissed) return null

    return (
        <div className="relative flex items-center gap-3 border-b border-amber-500/30 bg-amber-950/40 px-4 py-2.5 text-sm backdrop-blur-sm">
            {/* left accent line */}
            <div className="absolute inset-y-0 left-0 w-1 bg-amber-500" />

            <AlertTriangle className="ml-2 size-4 shrink-0 text-amber-400" aria-hidden="true" />

            <p className="min-w-0 flex-1 text-amber-200">
                <span className="font-semibold text-amber-400">Demo / Testnet Mode — </span>
                You are on Sepolia testnet. All contracts, tokens, and transactions have{' '}
                <span className="font-semibold">no real monetary value</span>. Do not send real funds.
            </p>

            <button
                onClick={() => setDismissed(true)}
                aria-label="Dismiss testnet warning"
                className="ml-2 shrink-0 rounded p-1 text-amber-400 transition-colors hover:bg-amber-500/20"
            >
                <X className="size-4" />
            </button>
        </div>
    )
}
