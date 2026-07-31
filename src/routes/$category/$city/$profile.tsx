import { createFileRoute } from '@tanstack/react-router'
import { PublicProfilePage } from '@/routes/profile.$id'
import { isPublicCategorySlug } from '@/lib/profile-url'
import { SITE_URL } from '@/lib/seo-regions'

export const Route = createFileRoute('/$category/$city/$profile')({
  head: ({ params }) => {
    const canonical = `${SITE_URL}/${encodeURIComponent(params.category)}/${encodeURIComponent(params.city)}/${encodeURIComponent(params.profile)}`
    const indexable = isPublicCategorySlug(params.category)
    return {
      meta: [
        { title: 'Perfil | TheSex' },
        { name: 'description', content: 'Informações, fotos e formas de contato de um perfil publicado.' },
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
