import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, MapPin, Search, SlidersHorizontal, X } from 'lucide-react'
import { profilesApi, type Profile } from '@/lib/api'

const CATEGORIES = ['Acompanhante', 'Massagem', 'Trans e Travesti', 'Encontro casual', 'Modelo independente']
const POPULAR_CITIES = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Brasília', 'Salvador']

export const Route = createFileRoute('/explore')({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : '',
    city: typeof search.city === 'string' ? search.city : '',
    category: typeof search.category === 'string' ? search.category : '',
  }),
  head: () => ({ meta: [{ title: 'Explorar perfis · TheSex' }, { name: 'description', content: 'Explore perfis independentes por categoria, cidade e interesse.' }] }),
  component: ExplorePage,
})

function ExplorePage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [term, setTerm] = useState(search.q)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setProfiles(await profilesApi.list(search))
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setTerm(search.q) }, [search.q])

  const cities = useMemo(() => [...new Set([...POPULAR_CITIES, ...profiles.map(profile => profile.city)])], [profiles])
  const apply = (changes: Partial<typeof search>) => navigate({ search: { ...search, ...changes } })
  const reset = () => navigate({ search: { q: '', city: '', category: '' } })
  const submit = (event: React.FormEvent) => { event.preventDefault(); apply({ q: term }) }

  return <main className="min-h-dvh bg-[#fffafb] text-slate-900">
    <header className="border-b border-pink-100 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6"><Link to="/" className="text-xl font-black tracking-tight text-pink-600">the<span className="text-slate-900">sex</span></Link><Link to="/create" className="rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-black text-white hover:bg-pink-700">Publicar perfil</Link></div></header>
    <section className="border-b border-pink-100 bg-white"><div className="mx-auto max-w-6xl px-4 py-7 sm:px-6"><Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-pink-600"><ArrowLeft className="h-4 w-4" /> Voltar à página inicial</Link><div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.18em] text-pink-600">Catálogo</p><h1 className="mt-2 text-3xl font-black">Perfis por cidade e categoria</h1><p className="mt-2 text-sm text-slate-500">Escolha os filtros e conheça perfis que já passaram pela análise.</p></div><span className="text-sm font-bold text-slate-500">{loading ? 'Carregando...' : `${profiles.length} ${profiles.length === 1 ? 'perfil' : 'perfis'}`}</span></div>
      <form onSubmit={submit} className="mt-6 flex rounded-2xl border border-pink-100 bg-pink-50 p-2 shadow-sm"><div className="flex flex-1 items-center gap-3 px-3"><Search className="h-5 w-5 text-pink-600"/><input value={term} onChange={event => setTerm(event.target.value)} placeholder="Nome, cidade, bairro ou interesse" className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-slate-400"/>{term && <button type="button" onClick={() => setTerm('')} aria-label="Limpar busca"><X className="h-4 w-4 text-slate-400"/></button>}</div><button className="rounded-xl bg-pink-600 px-5 text-sm font-black text-white hover:bg-pink-700">Buscar</button></form></div></section>
    <section className="mx-auto grid max-w-6xl gap-7 px-4 py-8 sm:px-6 lg:grid-cols-[250px_1fr]">
      <aside className="h-fit rounded-2xl border border-pink-100 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-sm font-black text-slate-800"><SlidersHorizontal className="h-4 w-4 text-pink-600"/> Filtros</div><FilterGroup label="Categoria">{CATEGORIES.map(category => <FilterButton key={category} active={search.category === category} onClick={() => apply({ category: search.category === category ? '' : category })}>{category}</FilterButton>)}</FilterGroup><FilterGroup label="Cidade">{cities.map(city => <FilterButton key={city} active={search.city === city} onClick={() => apply({ city: search.city === city ? '' : city })}>{city}</FilterButton>)}</FilterGroup>{(search.q || search.city || search.category) && <button onClick={reset} className="mt-4 text-sm font-bold text-pink-600 hover:text-pink-700">Limpar filtros</button>}</aside>
      <div>{loading ? <LoadingCards /> : profiles.length === 0 ? <EmptyState reset={reset} /> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{profiles.map(profile => <CatalogCard key={profile.id} profile={profile}/>)}</div>}</div>
    </section>
  </main>
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) { return <div className="mt-6"><h2 className="text-xs font-black uppercase tracking-[.14em] text-slate-400">{label}</h2><div className="mt-3 flex flex-wrap gap-2">{children}</div></div> }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-full border px-3 py-2 text-left text-xs font-bold transition ${active ? 'border-pink-600 bg-pink-600 text-white' : 'border-pink-100 text-slate-600 hover:border-pink-300 hover:text-pink-700'}`}>{children}</button> }
function CatalogCard({ profile }: { profile: Profile }) { const photo = profile.photos[0]; return <Link to="/profile/$id" params={{ id: profile.id }} className="group overflow-hidden rounded-2xl border border-pink-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"><div className="relative aspect-[4/3] bg-gradient-to-br from-pink-100 to-violet-100">{photo ? <img src={photo} alt={`Perfil de ${profile.name}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/> : <div className="flex h-full items-center justify-center text-sm font-bold text-pink-400">Foto em análise</div>}<span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-black text-pink-600 shadow-sm">{profile.category}</span>{profile.is_featured && <span className="absolute right-3 top-3 rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-black text-white">Destaque</span>}</div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900">{profile.name}, {profile.age}</h2><p className="mt-1 text-sm text-slate-500"><MapPin className="mr-1 inline h-3.5 w-3.5 text-pink-500"/>{profile.city}{profile.neighborhood ? ` · ${profile.neighborhood}` : ''}</p></div><span className="rounded-lg bg-pink-50 px-2 py-1 text-xs font-black text-pink-700">{profile.price}</span></div><p className="mt-4 line-clamp-2 text-sm leading-5 text-slate-500">{profile.description || 'Conheça os detalhes deste perfil.'}</p><p className="mt-4 text-sm font-black text-pink-600">Ver perfil <ArrowRight className="inline h-4 w-4"/></p></div></Link> }
function EmptyState({ reset }: { reset: () => void }) { return <div className="rounded-3xl border border-dashed border-pink-200 bg-pink-50 p-12 text-center"><Search className="mx-auto h-9 w-9 text-pink-300"/><h2 className="mt-4 text-lg font-black text-slate-800">Nenhum perfil encontrado</h2><p className="mt-2 text-sm text-slate-500">Tente trocar a cidade, categoria ou termo de busca.</p><button onClick={reset} className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-pink-600 shadow-sm">Limpar filtros</button></div> }
function LoadingCards() { return <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="overflow-hidden rounded-2xl border border-pink-100 bg-white"><div className="aspect-[4/3] animate-pulse bg-pink-100"/><div className="space-y-3 p-5"><div className="h-5 w-32 animate-pulse rounded bg-slate-100"/><div className="h-4 w-24 animate-pulse rounded bg-slate-100"/></div></div>)}</div> }
