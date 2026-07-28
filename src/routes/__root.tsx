/// <reference types="vite/client" />

import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import type { ReactNode } from 'react'
import indexCss from '../index.css?url'

const queryClient = new QueryClient()

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { title: 'TheSex — Perfis verificados' },
      { name: 'description', content: 'Perfis publicados com curadoria, privacidade e discrição.' },
      { name: 'theme-color', content: '#2e1114' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: 'TheSex — Perfis verificados' },
      { property: 'og:description', content: 'Perfis publicados com curadoria, privacidade e discrição.' },
      { property: 'og:site_name', content: 'TheSex' },
      { property: 'og:locale', content: 'pt_BR' },
    ],
    links: [
      { rel: 'stylesheet', href: indexCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={0}>
            <Toaster />
            {children}
          </TooltipProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
