import { Sidebar } from '@/components/layout/sidebar'
import { AppAccessGate } from '@/components/shared/app-access-gate'
import type { ReactNode } from 'react'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-screen overflow-hidden bg-transparent text-text transition-colors duration-200 antialiased selection:bg-teal/20 selection:text-teal">
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

      <div className="relative z-[10]">
        <Sidebar />
      </div>
      <main className="relative z-[10] flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
        <div className="h-full overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <AppAccessGate>{children}</AppAccessGate>
        </div>
      </main>
    </div>
  )
}
