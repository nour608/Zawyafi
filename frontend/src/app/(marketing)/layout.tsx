import { TopNav } from '@/components/layout/top-nav'
import type { ReactNode } from 'react'

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-cc-bg text-cc-text">
      <TopNav />
      <main className="flex-1 pt-24 md:pt-28">
        {children}
      </main>
    </div>
  )
}
