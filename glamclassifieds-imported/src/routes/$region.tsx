import { createFileRoute, Link as RouterLink } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, MapPin, Search } from 'lucide-react'
import { profilesApi, type Profile } from '@/lib/api'
import { getSeoRegion, SEO_REGIONS, SITE_URL } from '@/lib/seo-regions'

function Link(props: any) {
  if (props.to === '/profile/$id' && typeof props.params?.id === 'string' && props.params.id.startsWith('/')) {
    const { to: _to, params: _params, ...anchorProps } = props
    return <a href={_params.id} {...anchorProps} />
  }
  return <RouterLink {...props} />
}

export const Route = createFileRoute('/$region')({
  head: ({ params }) => {
    const region = getSeoRegion(params.region)
    if (!region) return { meta: [{ title: 'Página não encontrada | TheSex' }, { name: 'robots', content: 'noindex, nofollow' }] }
    const canonical = `${SITE_URL}/${region.slug}`
    const schema = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: region.title, description: region.description, url: canonical, isPartOf: { '@type': 'WebSite', name: 'TheSex', url: SITE_URL }, about: { '@type': 'City', name: region.city, address: { '@type': 'PostalAddress', addressRegion: region.state, addressCountry: 'BR' } } }
    return { meta: [{ title: `${region.title} | TheSex` }, { name: 'description', content: region.description }, { name: 'robots', content: 'index,follow,max-image-preview:large' }, { property: 'og:type', content: 'website' }, { property: 'og:title', content: `${region.title} | TheSex` }, { property: 'og:description', content: region.description }, { property: 'og:url', content: canonical }, { name: 'twitter:card', content: 'summary' }, { name: 'twitter:title', content: `${region.title} | TheSex` }, { name: 'twitter:description', content: region.description }], links: [{ rel: 'canonical', href: canonical }], scripts: [{ type: 'application/ld+json', children: JSON.stringify(schema) }] }
  },
  component: RegionPage,
})

function RegionPage() {
  const { region: slug } = Route.useParams()
  const region = getSeoRegion(slug)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const loadProfiles = useCallback(async () => { if (!region) return; setLoading(true); try { setProfiles(await profilesApi.list({ city: region.city })) } finally { setLoading(false) } }, [region])
  useEffect(() => { void loadProfiles() }, [loadProfiles])
  const neighborhoodCount = useMemo(() => new Set(profiles.map((profile) => profile.neighborhood).filter(Boolean)).size, [profiles])
  if (!region) return <main className="mx-auto min-h-dvh max-w-3xl px-5 py-24 text-center"><h1 className="text-3xl font-black">Página não encontrada</h1><Link to="/" className="mt-6 inline-flex font-bold text-pink-700">Voltar ao início</Link></main>
  return <main className="min-h-dvh bg-[#fbf7f7] text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4"><Link to="/" className="text-xl font-black tracking-tight text-pink-700">the<span className="text-slate-950">sex</span></Link><div className="flex items-center gap-4 text-sm font-bold"><Link to="/explore" search={{ q: '', city: region.city, category: '' }} className="text-slate-600 hover:text-pink-700">Explorar</Link><Link to="/create" className="rounded-full bg-pink-700 px-4 py-2 text-white hover:bg-pink-800">Publicar perfil</Link></div></div></header>
    <section className="border-b border-[#eadde1] bg-[#2b0920] text-white"><div className="mx-auto max-w-6xl px-5 py-12 sm:py-16"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-pink-300"><MapPin className="h-4 w-4" />{region.city} · {region.state}</p><h1 className="mt-4 max-w-3xl font-serif text-4xl font-black tracking-tight sm:text-6xl">{region.title}</h1><p className="mt-5 max-w-2xl text-base leading-7 text-pink-100">{region.intro}</p><div className="mt-7 flex flex-wrap gap-2"><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-bold">{loading ? 'Carregando...' : `${profiles.length} ${profiles.length === 1 ? 'perfil publicado' : 'perfis publicados'}`}</span>{neighborhoodCount > 0 && <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-bold">{neighborhoodCount} regiões</span>}</div></div></section>
    <section className="mx-auto max-w-6xl px-5 py-12"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-pink-700">Vitrine local</p><h2 className="mt-2 text-3xl font-black">Perfis publicados em {region.city}</h2></div><Link to="/explore" search={{ q: '', city: region.city, category: '' }} className="hidden items-center gap-1 text-sm font-black text-pink-700 sm:inline-flex">Ver todos no catálogo <ArrowRight className="h-4 w-4" /></Link></div>{loading ? <div className="mt-8 grid gap-px overflow-hidden rounded-sm border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-80 animate-pulse bg-white" />)}</div> : profiles.length === 0 ? <div className="mt-8 border border-dashed border-pink-200 bg-white px-6 py-12 text-center"><Search className="mx-auto h-8 w-8 text-pink-500" /><h3 className="mt-4 text-xl font-black">A vitrine de {region.city} está sendo atualizada</h3><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">Novos perfis passam por análise antes de aparecerem aqui. Enquanto isso, você pode pesquisar outras cidades no catálogo.</p><Link to="/explore" search={{ q: '', city: '', category: '' }} className="mt-5 inline-flex rounded-full bg-pink-700 px-5 py-3 text-sm font-black text-white">Abrir catálogo</Link></div> : <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{profiles.map((profile) => <ProfileTile key={profile.id} profile={profile} />)}</div>}</section>
    <section className="border-y border-slate-200 bg-white"><div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 lg:grid-cols-[.9fr_1.1fr]"><div><p className="text-xs font-black uppercase tracking-[.18em] text-pink-700">Guia local</p><h2 className="mt-3 text-3xl font-black">Como usar esta página</h2><p className="mt-4 leading-7 text-slate-600">Esta é a página local de {region.city}. Os perfis ativos são exibidos aqui de acordo com a cidade informada no cadastro. Use o catálogo para refinar por categoria ou para buscar em outras regiões.</p></div><div className="space-y-4">{[['Como os perfis aparecem?', 'Cada perfil é publicado após análise e pode ser atualizado pela pessoa responsável.'], ['Onde encontro mais opções?', 'Use a busca por cidade e categoria para navegar pelas páginas públicas da plataforma.'], ['Como entrar em contato?', 'Os dados de contato são apresentados apenas no perfil público, para uma comunicação direta.']].map(([question, answer]) => <article key={question} className="border-l-2 border-pink-600 pl-5"><h3 className="font-black">{question}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{answer}</p></article>)}</div></div></section>
    <section className="mx-auto max-w-6xl px-5 py-12"><p className="text-xs font-black uppercase tracking-[.18em] text-pink-700">Outras cidades</p><h2 className="mt-2 text-2xl font-black">Navegue por região</h2><nav aria-label="Páginas por cidade" className="mt-6 flex flex-wrap gap-2">{SEO_REGIONS.filter((item) => item.slug !== region.slug).map((item) => <a key={item.slug} href={`/${item.slug}`} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-pink-500 hover:text-pink-700">{item.title.replace('Perfis em ', '').replace('Perfis no ', '')}</a>)}</nav></section>
    <footer className="border-t border-slate-200 bg-white"><div className="mx-auto max-w-6xl px-5 py-8 text-sm text-slate-500">TheSex · Plataforma para maiores de 18 anos. Consulte os dados do perfil antes de iniciar contato.</div></footer>
  </main>
}

function ProfileTile({ profile }: { profile: Profile }) {
  const photo = profile.photos[0]
  return <Link to="/profile/$id" params={{ id: profile.id }} className="group overflow-hidden border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"><div className="relative aspect-[4/3] bg-[#e8dfe3]">{photo ? <img src={photo} alt={`Foto de ${profile.name}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-sm font-bold text-slate-500">Fotos em atualização</div>}<span className="absolute left-3 top-3 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-pink-700">{profile.category}</span></div><div className="p-5"><h3 className="text-xl font-black">{profile.name}, {profile.age}</h3><p className="mt-1 text-sm text-slate-600"><MapPin className="mr-1 inline h-3.5 w-3.5 text-pink-600" />{profile.neighborhood || profile.city}</p><p className="mt-4 text-sm font-black text-pink-700">Ver perfil <ArrowRight className="inline h-4 w-4" /></p></div></Link>
}
