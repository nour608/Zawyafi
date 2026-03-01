'use client'

import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'

interface CapabilityGateProps {
  enabled: boolean
  blockedLabel: string
  children: ReactNode
}

export const CapabilityGate = ({ enabled, blockedLabel, children }: CapabilityGateProps) => {
  if (enabled) {
    return <>{children}</>
  }

  return (
    <Card>
      <p className="text-sm text-warning">{blockedLabel}</p>
    </Card>
  )
}
