import { createFileRoute } from '@tanstack/react-router'
import { PublicProfilePage } from '@/routes/profile.$id'
import { isPublicCategorySlug } from '@/lib/profile-url'
import { SITE_URL } from '@/lib/seo-regions'

const CATEGORY_LABELS: Record<string, string> = { acompanhantes: 'Acompanhantes e escorts', massagens: 'Massagens', 'trans-e-travestis': 'Trans e travestis', 'encontros-casuais': 'Encontros casuais' }

export const Route = createFileRoute('/$category/$city/$profile')({
  head: ({ params }) => {
    const canonical = `${SITE_URL}/${encodeURIComponent(params.category)}/${encodeURIComponent(params.city)}/${encodeURIComponent(params.profile)}`
    const indexable = isPublicCategorySlug(params.category)
    const categoryLabel = CATEGORY_LABELS[params.category] ?? 'Perfis'
    const cityName = params.city.replace(/-/g, ' ')
    return {
      meta: [
        { title: `${categoryLabel} em ${cityName} | TheSex` },
        { name: 'description', content: `${categoryLabel} em ${cityName}. Consulte fotos, detalhes e formas de contato do perfil publicado.` },
        { name: 'keywords', content: `${categoryLabel}, acompanhantes em ${cityName}, escorts em ${cityName}, garotas de programa em ${cityName}, sexo casual` },
        { name: 'robots', content: indexable ? 'index,follow,max-image-preview:large' : 'noindex, nofollow' },
        { property: 'og:type', content: 'profile' },
        { property: 'og:url', content: canonical },
      ],
      links: [{ rel: 'canonical', href: canonical }],
    }
  },
  component: PublicProfileRoute,
})

function PublicProfileRoute() {
  const { profile } = Route.useParams()
  return <PublicProfilePage id={profile} />
}
