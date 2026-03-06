import { Sidebar } from '@/components/layout/sidebar'
import { AppAccessGate } from '@/components/shared/app-access-gate'
import { TestnetBanner } from '@/components/shared/testnet-banner'
import type { ReactNode } from 'react'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-transparent text-text transition-colors duration-200 antialiased selection:bg-teal/20 selection:text-teal">
      {/* Background decorations */}
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[var(--bg-base)]">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--border-subtle) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div
          className="absolute inset-0 opacity-80"
          style={{
            backgroundImage:
              'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
            backgroundSize: '62px 62px',
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_20%,rgba(184,137,47,0.08),transparent_38%),radial-gradient(circle_at_86%_82%,rgba(26,138,125,0.12),transparent_44%)]" />
      </div>

      {/* Testnet banner — above everything */}
      <div className="relative z-[20] shrink-0">
        <TestnetBanner />
      </div>

      {/* Sidebar + main content — horizontal row, fills remaining height */}
      <div className="relative z-[10] flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
          <div className="h-full overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
            <AppAccessGate>{children}</AppAccessGate>
          </div>
        </main>
      </div>
    </div>
  )
}
