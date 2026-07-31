import { createFileRoute, Link as RouterLink, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, MapPin, Phone, Search, X } from 'lucide-react'
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
  head: () => ({ meta: [{ title: 'Explorar perfis · TheSex' }, { name: 'description', content: 'Pesquise perfis por cidade, categoria e interesse.' }] }),
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
  const cities = useMemo(() => [...new Set([...POPULAR_CITIES, ...profiles.map(profile => profile.city)])], [profiles])
  const apply = (changes: Partial<typeof search>) => navigate({ search: { ...search, ...changes } })
  const reset = () => navigate({ search: { q: '', city: '', category: '' } })
  const submit = (event: React.FormEvent) => { event.preventDefault(); apply({ q: term }) }

  return <main className="min-h-dvh bg-[#fdfcfb] text-[#29262a]"><div className="h-1.5 bg-[#c51f69]" /><header className="border-b border-[#e9e3df] bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6"><Link to="/" className="text-lg font-black tracking-tight text-[#c51f69]">the<span className="text-[#28252a]">sex</span></Link><Link to="/create" className="rounded-md bg-[#438aca] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#3478b6]">PUBLICAR PERFIL</Link></div></header>
    <div className="border-b border-[#e9e3df] bg-white"><div className="mx-auto max-w-4xl px-4 py-4 sm:px-6"><Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#c51f69] hover:underline"><ArrowLeft className="h-3.5 w-3.5" />Voltar para a página inicial</Link><div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#c51f69]">Busca por cidade</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">Perfis publicados</h1></div><p className="text-xs font-medium text-[#746c70]">{loading ? 'Atualizando...' : `${profiles.length} ${profiles.length === 1 ? 'resultado' : 'resultados'}`}</p></div><form onSubmit={submit} className="mt-4 flex border border-[#dcd4d1] bg-white"><div className="flex flex-1 items-center gap-2 px-3"><Search className="h-4 w-4 text-[#c51f69]" /><input value={term} onChange={event => setTerm(event.target.value)} placeholder="Nome, cidade, bairro ou interesse" className="w-full py-2.5 text-sm outline-none placeholder:text-[#9b9294]" />{term && <button type="button" aria-label="Limpar busca" onClick={() => setTerm('')}><X className="h-4 w-4 text-[#8a8185]" /></button>}</div><button className="bg-[#c51f69] px-5 text-xs font-bold text-white hover:bg-[#ab1758]">BUSCAR</button></form></div></div>
    <section className="mx-auto max-w-4xl px-4 py-6 sm:px-6"><div className="border-b border-[#e6dfdc] pb-4"><FilterLine label="Categoria">{CATEGORIES.map(category => <FilterButton key={category} active={search.category === category} onClick={() => apply({ category: search.category === category ? '' : category })}>{category}</FilterButton>)}</FilterLine><FilterLine label="Cidade">{cities.map(city => <FilterButton key={city} active={search.city === city} onClick={() => apply({ city: search.city === city ? '' : city })}>{city}</FilterButton>)}</FilterLine>{(search.q || search.city || search.category) && <button onClick={reset} className="mt-3 text-xs font-bold text-[#c51f69] hover:underline">Limpar filtros</button>}</div>
      <div className="mt-5">{loading ? <LoadingRows /> : profiles.length === 0 ? <EmptyState reset={reset} /> : <div className="divide-y divide-[#e8e1de] border-y border-[#e8e1de]">{profiles.map(profile => <CatalogRow key={profile.id} profile={profile} />)}</div>}</div>
    </section>
  </main>
}

function FilterLine({ label, children }: { label: string; children: React.ReactNode }) { return <div className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-start"><span className="w-20 shrink-0 pt-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#968c8f]">{label}</span><div className="flex flex-wrap gap-1.5">{children}</div></div> }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${active ? 'border-[#c51f69] bg-[#c51f69] text-white' : 'border-[#ded7d4] bg-white text-[#61595d] hover:border-[#c51f69] hover:text-[#c51f69]'}`}>{children}</button> }
function CatalogRow({ profile }: { profile: Profile }) {
  const photo = profile.photos[0]
  const phone = profile.contact_phone.replace(/\D/g, '')
  return <article className="grid gap-3 py-4 sm:grid-cols-[132px_1fr_auto] sm:items-start"><Link to="/profile/$id" params={{ id: profile.id }} className="block overflow-hidden border border-[#e5dedb] bg-[#f2edeb]"><div className="aspect-[4/3]">{photo ? <img src={photo} alt={profile.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[10px] font-semibold text-[#948a8e]">Fotos em atualização</div>}</div></Link><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link to="/profile/$id" params={{ id: profile.id }} className="text-sm font-extrabold text-[#c51f69] hover:underline">{profile.name}</Link>{profile.is_featured && <span className="rounded-full bg-[#fff0f7] px-2 py-0.5 text-[9px] font-bold text-[#c51f69]">DESTAQUE</span>}</div><p className="mt-1 text-[11px] font-semibold text-[#6e666a]"><MapPin className="mr-1 inline h-3.5 w-3.5 text-[#c51f69]" />{profile.city}{profile.neighborhood ? ` · ${profile.neighborhood}` : ''} · {profile.age} anos</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-[#5f575b]">{profile.description || 'Conheça as informações deste perfil.'}</p><div className="mt-2 flex flex-wrap gap-1.5">{profile.services.slice(0, 3).map(service => <span key={service} className="rounded border border-[#e4ddda] px-1.5 py-0.5 text-[10px] text-[#6b6266]">{service}</span>)}</div><Link to="/profile/$id" params={{ id: profile.id }} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#438aca] hover:underline">Ver perfil<ArrowRight className="h-3.5 w-3.5" /></Link></div><div className="flex gap-2 sm:flex-col sm:items-end"><span className="rounded border border-[#eadedb] bg-[#fffafa] px-2.5 py-1 text-[11px] font-bold text-[#5a5054]">{profile.price}</span>{phone && <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded bg-[#24c965] px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-[#1bae56]"><Phone className="h-3 w-3" />WHATSAPP</a>}</div></article>
}
function EmptyState({ reset }: { reset: () => void }) { return <div className="border border-dashed border-[#dfd5d2] bg-white px-6 py-12 text-center"><Search className="mx-auto h-7 w-7 text-[#c51f69]" /><h2 className="mt-3 text-base font-bold">Nenhum perfil encontrado</h2><p className="mt-1 text-sm text-[#776e72]">Tente trocar a cidade, categoria ou termo de busca.</p><button onClick={reset} className="mt-4 text-xs font-bold text-[#c51f69] hover:underline">Limpar filtros</button></div> }
function LoadingRows() { return <div className="divide-y divide-[#e8e1de] border-y border-[#e8e1de]">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="grid gap-3 py-4 sm:grid-cols-[132px_1fr_auto]"><div className="aspect-[4/3] animate-pulse bg-[#f0ebea]" /><div className="space-y-2"><div className="h-4 w-36 animate-pulse bg-[#f0ebea]" /><div className="h-3 w-24 animate-pulse bg-[#f0ebea]" /><div className="h-8 animate-pulse bg-[#f0ebea]" /></div></div>)}</div> }
