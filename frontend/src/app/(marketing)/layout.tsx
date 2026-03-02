import { TopNav } from '@/components/layout/top-nav'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AssetTicker } from '@/components/AssetTicker'
import type { ReactNode } from 'react'

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-cc-bg text-cc-text">
      <TopNav />
      <ThemeToggle />
      <main className="flex-1 pb-[60px] pt-24 md:pt-28">{children}</main>
      <AssetTicker />
    </div>
  )
}
