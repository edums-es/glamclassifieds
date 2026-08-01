import { createFileRoute, Link as RouterLink, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, MapPin, Phone, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { profilesApi, type Profile } from '@/lib/api'

const CATEGORIES = ['Acompanhante', 'Massagem', 'Trans e Travesti', 'Encontro casual']
const POPULAR_CITIES = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Brasília', 'Salvador']

function Link(props: any) {
  if (props.to === '/profile/$id' && typeof props.params?.id === 'string' && props.params.id.startsWith('/')) {
    const { to: _to, params: _params, ...anchorProps } = props
    return <a href={_params.id} {...anchorProps} />
  }
  return <RouterLink {...props} />
}

export const Route = createFileRoute('/explore')({
  validateSearch: (search: Record<string, unknown>) => ({ q: typeof search.q === 'string' ? search.q : '', city: typeof search.city === 'string' ? search.city : '', category: typeof search.category === 'string' ? search.category : '' }),
  head: () => ({ meta: [{ title: 'Acompanhantes, escorts e encontros | TheSex' }, { name: 'description', content: 'Explore acompanhantes, escorts, massagens e encontros por cidade.' }] }),
  component: ExplorePage,
})

function ExplorePage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [term, setTerm] = useState(search.q)
  const load = useCallback(async () => { setLoading(true); try { setProfiles(await profilesApi.list(search)) } finally { setLoading(false) } }, [search])
  useEffect(() => { void load() }, [load])
  useEffect(() => { setTerm(search.q) }, [search.q])
  const cities = useMemo(() => {
    const seen = new Set<string>()
    return [...POPULAR_CITIES, ...profiles.map(profile => profile.city)].filter(city => {
      const key = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [profiles])
  const apply = (changes: Partial<typeof search>) => navigate({ search: { ...search, ...changes } })
  const reset = () => navigate({ search: { q: '', city: '', category: '' } })
  const submit = (event: React.FormEvent) => { event.preventDefault(); apply({ q: term }) }
  const hasFilters = Boolean(search.q || search.city || search.category)

  return <main className="min-h-dvh bg-[#f6f3f1] text-[#201d24]">
    <div className="h-1.5 bg-gradient-to-r from-[#b70858] via-[#ee177a] to-[#6a37d7]" />
    <SiteHeader />
    <section className="border-b border-[#e7dedb] bg-[#17131c] text-white">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-7 lg:px-9 lg:py-11">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-pink-200 transition hover:text-white"><ArrowLeft className="h-3.5 w-3.5"/> Voltar à página inicial</Link>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,.8fr)] lg:items-end">
          <div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-pink-300">Explore por cidade</p><h1 className="mt-2 max-w-xl text-3xl font-black tracking-tight sm:text-4xl">Encontre perfis que combinam com a sua busca.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Filtre por cidade, categoria e interesse. O contato é direto e cada perfil passa por análise antes de ser publicado.</p></div>
          <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white p-2 shadow-2xl shadow-black/20"><div className="flex items-center gap-2"><Search className="ml-2 h-5 w-5 shrink-0 text-[#c51f69]"/><input value={term} onChange={event => setTerm(event.target.value)} placeholder="Nome, cidade, bairro ou interesse" className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400" />{term && <button type="button" aria-label="Limpar busca" onClick={() => setTerm('')} className="p-2 text-slate-400 hover:text-slate-700"><X className="h-4 w-4"/></button>}<button className="rounded-xl bg-[#c51f69] px-5 py-3 text-xs font-black text-white transition hover:bg-[#a91656]">BUSCAR</button></div></form>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-5 py-7 sm:px-7 lg:px-9 lg:py-9">
      <div className="grid gap-6 xl:grid-cols-[245px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-[#e4dcda] bg-white p-5 shadow-[0_10px_24px_rgba(65,32,46,.045)] xl:sticky xl:top-6">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-extrabold"><SlidersHorizontal className="h-4 w-4 text-[#c51f69]"/> Filtros</div>{hasFilters && <button type="button" onClick={reset} className="text-xs font-bold text-[#c51f69] hover:underline">Limpar</button>}</div>
          <FilterGroup title="Categoria">{CATEGORIES.map(category => <FilterButton key={category} active={search.category === category} onClick={() => apply({ category: search.category === category ? '' : category })}>{category}</FilterButton>)}</FilterGroup>
          <FilterGroup title="Cidade">{cities.map(city => <FilterButton key={city} active={search.city === city} onClick={() => apply({ city: search.city === city ? '' : city })}>{city}</FilterButton>)}</FilterGroup>
        </aside>
        <div className="min-w-0"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#a18e95]">Vitrine</p><h2 className="mt-1 text-2xl font-black tracking-tight">Perfis publicados</h2></div><div className="rounded-full border border-[#e2d9d7] bg-white px-3 py-1.5 text-xs font-bold text-[#61575d]">{loading ? 'Atualizando...' : `${profiles.length} ${profiles.length === 1 ? 'perfil encontrado' : 'perfis encontrados'}`}</div></div>
          {loading ? <LoadingCards /> : profiles.length === 0 ? <EmptyState reset={reset} /> : <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{profiles.map(profile => <CatalogCard key={profile.id} profile={profile} />)}</div>}
        </div>
      </div>
    </section>
  </main>
}

function SiteHeader() { return <header className="border-b border-[#e9e3df] bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-7 lg:px-9"><Link to="/" className="text-xl font-black tracking-[-.06em] text-[#d41469]">the<span className="text-[#1e1a21]">sex</span></Link><Link to="/create" className="rounded-lg bg-[#438aca] px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#3478b6]">PUBLICAR PERFIL</Link></div></header> }
function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) { return <div className="mt-6 border-t border-[#eee8e6] pt-5"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#91858b]">{title}</p><div className="mt-3 flex flex-wrap gap-2">{children}</div></div> }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${active ? 'border-[#c51f69] bg-[#c51f69] text-white shadow-sm' : 'border-[#e4dcda] bg-[#fcfbfa] text-[#63595e] hover:border-[#d6719d] hover:text-[#c51f69]'}`}>{children}</button> }

function CatalogCard({ profile }: { profile: Profile }) {
  const photo = profile.photos[0]
  const phone = profile.contact_phone.replace(/\D/g, '')
  return <article className="group overflow-hidden rounded-2xl border border-[#e4dcda] bg-white shadow-[0_10px_24px_rgba(65,32,46,.05)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(65,32,46,.12)]"><Link to="/profile/$id" params={{ id: profile.id }} className="relative block overflow-hidden bg-[#eee9e6]"><div className="aspect-[4/4.7]">{photo ? <img src={photo} alt={profile.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"/> : <div className="grid h-full place-items-center text-xs font-semibold text-[#948a8e]">Fotos em atualização</div>}</div><div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/65 to-transparent"/>{profile.is_featured && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#d2146a] px-2.5 py-1 text-[10px] font-black text-white shadow-lg"><Sparkles className="h-3 w-3"/> DESTAQUE</span>}<span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-[#423a3e] backdrop-blur">{profile.city}</span></Link><div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link to="/profile/$id" params={{ id: profile.id }} className="block truncate text-lg font-black tracking-tight text-[#272129] hover:text-[#c51f69]">{profile.name}</Link><p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#756a70]"><MapPin className="h-3.5 w-3.5 text-[#c51f69]"/>{profile.neighborhood || profile.city} · {profile.age} anos</p></div><span className="shrink-0 rounded-lg bg-[#f8f1f4] px-2 py-1 text-[11px] font-black text-[#9d275b]">{profile.price}</span></div><p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-[#655c61]">{profile.description || 'Consulte fotos, serviços e informações deste perfil.'}</p><div className="mt-3 flex min-h-6 flex-wrap gap-1.5">{profile.services.slice(0, 2).map(service => <span key={service} className="rounded-md bg-[#f7f4f2] px-2 py-1 text-[10px] font-bold text-[#71676b]">{service}</span>)}</div><div className="mt-4 flex gap-2"><Link to="/profile/$id" params={{ id: profile.id }} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-[#ded5d4] px-3 py-2.5 text-xs font-black text-[#3d3539] transition hover:border-[#c51f69] hover:text-[#c51f69]">Ver perfil <ArrowRight className="h-3.5 w-3.5"/></Link>{phone && <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" aria-label={`Falar com ${profile.name} no WhatsApp`} className="inline-flex items-center justify-center rounded-xl bg-[#21c664] px-3 text-white transition hover:bg-[#18aa53]"><Phone className="h-4 w-4"/></a>}</div></div></article>
}

function EmptyState({ reset }: { reset: () => void }) { return <div className="rounded-2xl border border-dashed border-[#dfd5d2] bg-white px-6 py-16 text-center"><Search className="mx-auto h-8 w-8 text-[#c51f69]"/><h2 className="mt-4 text-lg font-black">Nenhum perfil encontrado</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#776e72]">Tente trocar a cidade, categoria ou termo da busca.</p><button onClick={reset} className="mt-5 rounded-xl bg-[#c51f69] px-4 py-2.5 text-xs font-black text-white hover:bg-[#aa1758]">Limpar filtros</button></div> }
function LoadingCards() { return <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="overflow-hidden rounded-2xl border border-[#e4dcda] bg-white"><div className="aspect-[4/4.7] animate-pulse bg-[#eee9e6]"/><div className="space-y-3 p-4"><div className="h-5 w-2/5 animate-pulse rounded bg-[#eee9e6]"/><div className="h-3 w-1/3 animate-pulse rounded bg-[#eee9e6]"/><div className="h-10 animate-pulse rounded bg-[#eee9e6]"/></div></div>)}</div> }
