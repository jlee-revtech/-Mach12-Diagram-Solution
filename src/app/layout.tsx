import type { Metadata } from 'next'
import '@/styles/globals.css'
import { AuthProvider } from '@/lib/supabase/auth-context'
import { ThemeProvider } from '@/lib/theme-context'
import { AppChrome } from '@/components/studio/AppChrome'

export const metadata: Metadata = {
  title: 'Solution Architecture Studio | Mach12.ai',
  description:
    'AI-powered SAP data architecture diagrams, BPMN process models, and capability maps for Aerospace & Defense.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Noto+Sans:wght@400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&family=Space+Mono:wght@400;700&family=Work+Sans:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <AppChrome>{children}</AppChrome>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
