import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { profilesApi, type Profile } from '@/lib/api'
import { SITE_URL } from '@/lib/seo-regions'
import { publicProfilePath } from '@/lib/profile-url'
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, Copy, Expand, Flag, Heart, Image as ImageIcon, MapPin, Phone, Share2, ShieldCheck, Sparkles, X } from 'lucide-react'

export const Route = createFileRoute('/profile/$id')({
  head: ({ params }) => {
    const canonical = `${SITE_URL}/profile/${encodeURIComponent(params.id)}`
    return { meta: [{ title: 'Perfil | TheSex' }, { name: 'description', content: 'Informações, fotos e formas de contato de um perfil publicado.' }, { name: 'robots', content: 'noindex, nofollow' }, { property: 'og:type', content: 'profile' }, { property: 'og:url', content: canonical }], links: [{ rel: 'canonical', href: canonical }] }
  },
  component: ProfilePage,
})

function ProfilePage() { const { id } = Route.useParams(); return <PublicProfilePage id={id} legacy /> }

export function PublicProfilePage({ id }: { id: string; legacy?: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [liked, setLiked] = useState(false)
  const [copied, setCopied] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const loaded = await profilesApi.get(id)
      setProfile(loaded)
      const canonicalPath = publicProfilePath(loaded)
      if (window.location.pathname !== canonicalPath) { window.location.replace(canonicalPath); return }
    } catch (error) { console.error('Não foi possível carregar o perfil:', error); setProfile(null) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { void load() }, [load])
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: profile?.name ?? 'TheSex', url: window.location.href })
      else { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 2200) }
    } catch (error) { if ((error as Error).name !== 'AbortError') console.error('Não foi possível compartilhar:', error) }
  }
  if (loading) return <ProfileSkeleton />
  if (!profile) return <NotFound />

  const phone = profile.contact_phone.replace(/\D/g, '')
  const profileSchema = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Person', name: profile.name, url: `${SITE_URL}${publicProfilePath(profile)}`, address: { '@type': 'PostalAddress', addressLocality: profile.city, addressCountry: 'BR' }, description: profile.description, image: profile.photos }).replace(/</g, '\\u003c')
  return <main className="min-h-dvh bg-[#f6f3f1] text-[#211d24]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: profileSchema }} />
    <div className="h-1.5 bg-gradient-to-r from-[#b70858] via-[#ee177a] to-[#6a37d7]" />
    <SiteHeader />
    <article className="mx-auto max-w-7xl px-5 pb-16 pt-6 sm:px-7 lg:px-9 lg:pt-8">
      <Link to="/explore" search={{ q: '', city: '', category: '' }} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#c51f69] hover:underline"><ArrowLeft className="h-3.5 w-3.5"/> Voltar para a busca</Link>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#9d8790]">TheSex / {profile.category} / {profile.city}</p><div className="mt-2 flex flex-wrap items-center gap-2"><h1 className="text-3xl font-black tracking-tight text-[#271f27] sm:text-4xl">{profile.name}</h1>{profile.is_featured && <span className="inline-flex items-center gap-1 rounded-full bg-[#d2146a] px-2.5 py-1 text-[10px] font-black text-white"><Sparkles className="h-3 w-3"/> PERFIL EM DESTAQUE</span>}</div><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-[#71656c]"><span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-[#c51f69]"/>{profile.city}{profile.neighborhood ? ` · ${profile.neighborhood}` : ''}</span><span>{profile.age} anos</span><span className="rounded-md border border-[#e1d8d5] bg-white px-2 py-1 text-[11px]">{profile.category}</span></div></div>
        <div className="flex justify-start gap-2 lg:justify-end"><button aria-label={liked ? 'Remover dos favoritos' : 'Salvar nos favoritos'} onClick={() => setLiked(value => !value)} className={`grid h-10 w-10 place-items-center rounded-xl border bg-white shadow-sm transition ${liked ? 'border-[#e89abb] bg-[#fff1f7] text-[#c51f69]' : 'border-[#e4dcda] text-[#72676c] hover:border-[#d6719d] hover:text-[#c51f69]'}`}><Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`}/></button><button aria-label="Compartilhar perfil" onClick={share} className="grid h-10 w-10 place-items-center rounded-xl border border-[#e4dcda] bg-white text-[#72676c] shadow-sm transition hover:border-[#d6719d] hover:text-[#c51f69]"><Share2 className="h-4 w-4"/></button></div>
      </div>

      <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0"><Gallery photos={profile.photos} profileName={profile.name} /><section className="mt-6 rounded-2xl border border-[#e5ddda] bg-white p-5 shadow-[0_10px_24px_rgba(65,32,46,.045)] sm:p-6"><SectionTitle icon={<Sparkles className="h-4 w-4"/>}>Sobre {profile.name}</SectionTitle><p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#5f555c]">{profile.description || 'Informações em atualização.'}</p>{profile.tags.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{profile.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}</div>}</section><div className="mt-5 grid gap-5 sm:grid-cols-2"><DetailCard title="Serviços" values={profile.services}/><DetailCard title="Atende" values={profile.service_for}/><DetailCard title="Local de atendimento" values={profile.meeting_places}/><DetailCard title="Formas de pagamento" values={profile.payment_methods}/></div></div>
        <aside className="space-y-4 lg:sticky lg:top-6"><section className="overflow-hidden rounded-2xl bg-[#211720] text-white shadow-xl shadow-[#4b1936]/15"><div className="border-b border-white/10 p-5"><p className="text-[10px] font-black uppercase tracking-[.15em] text-pink-200">Contato direto</p><p className="mt-2 text-lg font-black">Fale com {profile.name}</p><p className="mt-1 text-xs leading-5 text-slate-300">Combine os detalhes diretamente, com privacidade e discrição.</p></div><div className="p-5"><div className="flex items-center justify-between rounded-xl bg-white/8 px-3 py-2.5"><span className="text-xs font-semibold text-slate-300">Valor</span><strong className="text-sm text-white">{profile.price}</strong></div>{profile.availability && <div className="mt-2 flex items-center gap-2 px-1 text-xs font-medium text-pink-100"><CheckCircle2 className="h-3.5 w-3.5"/> {profile.availability}</div>}<div className="mt-5 grid gap-2">{phone && <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#20c866] px-4 py-3.5 text-xs font-black text-white transition hover:bg-[#16ac52]"><Phone className="h-4 w-4"/> CHAMAR NO WHATSAPP</a>}{phone && <a href={`tel:+${phone}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-xs font-black text-white transition hover:bg-white/10"><Phone className="h-3.5 w-3.5"/> LIGAR AGORA</a>}</div>{copied && <p className="mt-3 text-center text-xs font-semibold text-emerald-300">Link copiado.</p>}</div></section><section className="rounded-2xl border border-[#ead5df] bg-[#fffafd] p-4 text-xs leading-5 text-[#685a62]"><div className="flex items-center gap-2 font-black text-[#c51f69]"><ShieldCheck className="h-4 w-4"/> Publicação analisada</div><p className="mt-2">Fotos e informações passam por revisão antes de entrar na vitrine pública.</p><a href="mailto:abuse@thesex.online?subject=Denúncia%20de%20perfil%20TheSex" className="mt-3 inline-flex items-center gap-1 font-bold text-[#c51f69] hover:underline"><Flag className="h-3.5 w-3.5"/> Reportar abuso ou golpe</a></section></aside>
      </div>
    </article>
  </main>
}

function SiteHeader() { return <header className="border-b border-[#e9e3df] bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-7 lg:px-9"><Link to="/" className="text-xl font-black tracking-[-.06em] text-[#d41469]">the<span className="text-[#1e1a21]">sex</span></Link><Link to="/create" className="rounded-lg bg-[#438aca] px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#3478b6]">PUBLICAR PERFIL</Link></div></header> }

function Gallery({ photos, profileName }: { photos: string[]; profileName: string }) {
  const [selected, setSelected] = useState<number | null>(null)
  useEffect(() => {
    if (selected === null) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); if (event.key === 'ArrowRight') setSelected(index => index === null ? null : (index + 1) % photos.length); if (event.key === 'ArrowLeft') setSelected(index => index === null ? null : (index - 1 + photos.length) % photos.length) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected, photos.length])
  if (photos.length === 0) return <section className="grid min-h-80 place-items-center rounded-2xl border border-[#e6dedb] bg-[#eee9e7] text-sm font-semibold text-[#857b7e]"><span className="flex flex-col items-center gap-2"><ImageIcon className="h-7 w-7"/>Fotos em atualização</span></section>
  const open = (index: number) => setSelected(index)
  return <><section aria-label="Galeria de fotos" className={`grid gap-1 overflow-hidden rounded-2xl bg-[#ddd5d3] shadow-[0_12px_28px_rgba(65,32,46,.12)] ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} ${photos.length > 2 ? 'md:grid-cols-4' : ''}`}>
    {photos.map((photo, index) => <button key={photo} type="button" onClick={() => open(index)} className={`group relative min-h-48 overflow-hidden bg-[#ece6e3] text-left ${index === 0 && photos.length > 2 ? 'col-span-2 row-span-2 min-h-[390px]' : 'min-h-[195px]'} ${photos.length === 1 ? 'min-h-[460px]' : ''}`}><img src={photo} alt={`Foto ${index + 1} de ${profileName}`} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"/><span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20"/><span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-lg bg-black/65 px-2.5 py-1.5 text-[10px] font-black text-white opacity-0 backdrop-blur transition group-hover:opacity-100"><Expand className="h-3.5 w-3.5"/> AMPLIAR</span>{index === 0 && photos.length > 1 && <span className="absolute bottom-3 left-3 rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] font-black text-[#423a3e] backdrop-blur">{photos.length} FOTOS</span>}</button>)}
  </section>{selected !== null && <Lightbox photos={photos} profileName={profileName} selected={selected} onClose={() => setSelected(null)} onPrevious={() => setSelected(index => index === null ? null : (index - 1 + photos.length) % photos.length)} onNext={() => setSelected(index => index === null ? null : (index + 1) % photos.length)} />}</>
}

function Lightbox({ photos, profileName, selected, onClose, onPrevious, onNext }: { photos: string[]; profileName: string; selected: number; onClose: () => void; onPrevious: () => void; onNext: () => void }) { return <div role="dialog" aria-modal="true" aria-label="Foto ampliada" onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"><div onClick={event => event.stopPropagation()} className="relative flex h-full w-full max-w-6xl items-center justify-center"><img src={photos[selected]} alt={`Foto ${selected + 1} de ${profileName}`} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"/><button type="button" aria-label="Fechar foto" onClick={onClose} className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white transition hover:bg-white hover:text-black"><X className="h-5 w-5"/></button>{photos.length > 1 && <><button type="button" aria-label="Foto anterior" onClick={onPrevious} className="absolute left-1 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white transition hover:bg-white hover:text-black sm:left-4"><ChevronLeft className="h-6 w-6"/></button><button type="button" aria-label="Próxima foto" onClick={onNext} className="absolute right-1 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white transition hover:bg-white hover:text-black sm:right-4"><ChevronRight className="h-6 w-6"/></button></>}<p className="absolute bottom-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white">{selected + 1} de {photos.length}</p></div></div> }

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) { return <h2 className="flex items-center gap-2 text-base font-black text-[#302931]"><span className="text-[#c51f69]">{icon}</span>{children}</h2> }
function Tag({ children }: { children: ReactNode }) { return <span className="rounded-lg bg-[#f8f3f5] px-2.5 py-1.5 text-[11px] font-bold text-[#8e375b]">{children}</span> }
function DetailCard({ title, values }: { title: string; values: string[] }) { if (values.length === 0) return null; return <section className="rounded-2xl border border-[#e5ddda] bg-white p-5 shadow-[0_8px_20px_rgba(65,32,46,.035)]"><SectionTitle icon={<CheckCircle2 className="h-4 w-4"/>}>{title}</SectionTitle><div className="mt-4 flex flex-wrap gap-2">{values.map(value => <Tag key={value}>{value}</Tag>)}</div></section> }
function ProfileSkeleton() { return <main className="min-h-dvh bg-[#f6f3f1]"><div className="h-1.5 bg-[#c51f69]"/><div className="mx-auto max-w-7xl px-5 py-10 sm:px-7 lg:px-9"><div className="h-3 w-32 animate-pulse rounded bg-[#e8e1de]"/><div className="mt-6 h-12 w-80 max-w-full animate-pulse rounded bg-[#e8e1de]"/><div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="min-h-[480px] animate-pulse rounded-2xl bg-[#e8e1de]"/><div className="min-h-80 animate-pulse rounded-2xl bg-[#e8e1de]"/></div></div></main> }
function NotFound() { return <main className="grid min-h-dvh place-items-center bg-[#f6f3f1] px-4 text-center"><div><Sparkles className="mx-auto h-9 w-9 text-[#c51f69]"/><h1 className="mt-4 text-xl font-black">Perfil não encontrado</h1><p className="mt-2 text-sm text-[#736a6e]">Este perfil pode estar em revisão ou ter sido pausado.</p><Link to="/explore" search={{ q: '', city: '', category: '' }} className="mt-5 inline-block rounded-xl bg-[#c51f69] px-4 py-3 text-xs font-black text-white">VER PERFIS</Link></div></main> }
