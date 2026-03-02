import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { Providers } from '@/components/layout/providers'
import { AnimatedBackground } from '@/components/AnimatedBackground'
import '@/app/globals.css'


export const metadata: Metadata = {
  title: 'Zawyafi - Tokenized Private Markets Marketplace',
  description:
    'Unlock access to premium GCC private market opportunities. Tokenized for fractional ownership, instant settlement, and 24/7 trading.',
  icons: {
    icon: '/zawyafi-outlined-z.svg',
    shortcut: '/zawyafi-outlined-z.svg',
    apple: '/zawyafi-outlined-z.svg',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  // Add script to prevent flash of wrong theme before hydration
  const themeScript = `
    (function() {
      try {
        var localTheme = window.localStorage.getItem('theme');
        var theme = localTheme ? localTheme : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        }
      } catch (e) {}
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="overflow-x-hidden min-h-screen relative">
        <AnimatedBackground />

        <Providers>
          {/* Main content z-index ensures it stays above the AnimatedBackground */}
          <div className="relative z-[10] min-h-screen">{children}</div>
        </Providers>
      </body>
    </html>
  )
}
