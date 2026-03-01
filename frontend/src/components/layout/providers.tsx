'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { ThirdwebProvider } from 'thirdweb/react'

interface ProvidersProps {
  children: ReactNode
}

const shouldEnableDevtools = process.env.NODE_ENV !== 'production'

export const Providers = ({ children }: ProvidersProps) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 1,
          },
        },
      }),
  )

  return (
    <ThirdwebProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster theme="dark" richColors closeButton />
        {shouldEnableDevtools ? <ReactQueryDevtools initialIsOpen={false} /> : null}
      </QueryClientProvider>
    </ThirdwebProvider>
  )
}
