import { Sidebar } from '@/components/layout/sidebar'
import type { ReactNode } from 'react'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-base)] text-text transition-colors duration-200 antialiased selection:bg-teal/20 selection:text-teal">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
        <div className="h-full overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  )
}
