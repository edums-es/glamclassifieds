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
      { title: 'Acompanhantes, Escorts e Garotas de Programa | TheSex' },
      { name: 'description', content: 'Encontre acompanhantes, escorts, garotas de programa e encontros casuais na sua cidade. Perfis independentes, fotos e contato direto no TheSex.' },
      { name: 'keywords', content: 'acompanhantes, escorts, garotas de programa, acompanhantes de luxo, sexo casual, encontros casuais, acompanhantes perto de mim' },
      { name: 'robots', content: 'index,follow,max-image-preview:large' },
      { name: 'theme-color', content: '#2e1114' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: 'Acompanhantes, Escorts e Garotas de Programa | TheSex' },
      { property: 'og:description', content: 'Acompanhantes, escorts e encontros casuais por cidade. Encontre perfis e fale direto.' },
      { property: 'og:site_name', content: 'TheSex' },
      { property: 'og:locale', content: 'pt_BR' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [{ rel: 'stylesheet', href: indexCss }, { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return <html lang="pt-BR"><head><HeadContent /></head><body><QueryClientProvider client={queryClient}><TooltipProvider delayDuration={0}><Toaster />{children}</TooltipProvider></QueryClientProvider><Scripts /></body></html>
}
