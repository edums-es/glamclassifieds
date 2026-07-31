import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { profilesApi, type Profile } from '@/lib/api'
import { ArrowLeft, BadgeCheck, ChevronLeft, ChevronRight, Clock3, CreditCard, Flag, Heart, MapPin, MapPinned, Phone, Share2, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'

export const Route = createFileRoute('/profile/$id')({
  head: () => ({ meta: [{ title: 'Perfil · TheSex' }, { name: 'description', content: 'Conheça um perfil publicado no TheSex.' }] }),
  component: ProfilePage,
})

function ProfilePage() {
  return <main className="min-h-dvh bg-[#fffaf8] text-slate-950"><ProfileContent /></main>
}

function ProfileContent() {
  const { id } = Route.useParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePhoto, setActivePhoto] = useState(0)
  const [liked, setLiked] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try { setProfile(await profilesApi.get(id)) }
    catch (error) { console.error('Não foi possível carregar o perfil:', error); setProfile(null) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { loadProfile() }, [loadProfile])

  const shareProfile = async () => {
    const data = { title: profile?.name ?? 'TheSex', text: 'Confira este perfil no TheSex.', url: window.location.href }
    try {
      if (navigator.share) await navigator.share(data)
      else {
        await navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2200)
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') console.error('Não foi possível compartilhar o perfil:', error)
    }
  }

  if (loading) return <ProfileSkeleton />
  if (!profile) return <NotFound />

  const photos = profile.photos
  const hasManyPhotos = photos.length > 1
  const image = photos[activePhoto]
  const showPrevious = () => setActivePhoto(current => (current - 1 + photos.length) % photos.length)
  const showNext = () => setActivePhoto(current => (current + 1) % photos.length)

  return <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
    <Link to="/explore" search={{ q: '', city: '', category: '' }} className="group mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-[#8e1839]"><ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />Voltar para a busca</Link>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
      <section className="overflow-hidden rounded-[1.75rem] border border-[#eadedb] bg-white shadow-[0_22px_70px_-36px_rgba(59,8,25,.35)]">
        <div className="relative aspect-[4/5] overflow-hidden bg-[#f3edeb] sm:aspect-[16/15]">
          {image ? <img src={image} alt={`Foto de ${profile.name}`} className="h-full w-full object-cover" /> : <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-400"><Sparkles className="h-9 w-9" /><p className="text-sm font-medium">Fotos em atualização</p></div>}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
          {profile.is_featured && <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-[#8e1839] shadow-sm"><Sparkles className="h-3.5 w-3.5" />Em destaque</span>}
          {hasManyPhotos && <><button aria-label="Foto anterior" onClick={showPrevious} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-800 shadow-md transition hover:bg-white"><ChevronLeft className="h-5 w-5" /></button><button aria-label="Próxima foto" onClick={showNext} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-800 shadow-md transition hover:bg-white"><ChevronRight className="h-5 w-5" /></button><span className="absolute bottom-4 right-4 rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white">{activePhoto + 1} / {photos.length}</span></>}
        </div>
        {hasManyPhotos && <div className="flex gap-2 overflow-x-auto p-3 sm:p-4">{photos.map((url, index) => <button key={url} onClick={() => setActivePhoto(index)} className={`h-16 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition ${index === activePhoto ? 'border-[#8e1839] shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'}`}><img src={url} alt={`Miniatura ${index + 1}`} className="h-full w-full object-cover" /></button>)}</div>}
      </section>
      <aside className="rounded-[1.75rem] border border-[#eadedb] bg-white p-5 shadow-[0_22px_70px_-36px_rgba(59,8,25,.35)] sm:p-6 lg:sticky lg:top-6">
        <div className="flex items-start justify-between gap-4"><div><span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.16em] text-[#9d2044]"><BadgeCheck className="h-3.5 w-3.5" />Perfil revisado</span><h1 className="mt-2 font-serif text-3xl font-bold leading-[1.04] text-slate-950">{profile.name}</h1><div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-medium text-slate-600"><span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-[#9d2044]" />{profile.city}{profile.neighborhood ? ` · ${profile.neighborhood}` : ''}</span><span className="h-1 w-1 rounded-full bg-slate-300" /><span>{profile.age} anos</span></div></div><div className="flex shrink-0 gap-2"><button aria-label={liked ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} onClick={() => setLiked(value => !value)} className={`grid h-10 w-10 place-items-center rounded-full border transition ${liked ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-[#eadedb] text-slate-500 hover:border-[#ca9aa9] hover:text-[#8e1839]'}`}><Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} /></button><button aria-label="Compartilhar perfil" onClick={shareProfile} className="grid h-10 w-10 place-items-center rounded-full border border-[#eadedb] text-slate-500 transition hover:border-[#ca9aa9] hover:text-[#8e1839]"><Share2 className="h-4 w-4" /></button></div></div>
        <div className="mt-6 rounded-2xl bg-[#5b0b22] px-5 py-4 text-white"><p className="text-xs font-semibold uppercase tracking-[.14em] text-rose-200">Informação de valor</p><p className="mt-1 text-2xl font-bold">{profile.price}</p></div>
        <div className="mt-6"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#9d2044]">Sobre</p><p className="mt-2 text-sm leading-6 text-slate-600">{profile.description}</p></div>
        {profile.availability && <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#fff7f5] px-3.5 py-3 text-sm font-medium text-slate-700"><Clock3 className="h-4 w-4 text-[#9d2044]" />{profile.availability}</div>}
        <div className="mt-6 grid gap-4 border-t border-[#eadedb] pt-5"><DetailList title="Serviços" icon={<BadgeCheck className="h-4 w-4 text-[#9d2044]" />} values={profile.services} /><DetailList title="Atende" icon={<UsersRound className="h-4 w-4 text-[#9d2044]" />} values={profile.service_for} /><DetailList title="Local de atendimento" icon={<MapPinned className="h-4 w-4 text-[#9d2044]" />} values={profile.meeting_places} /><DetailList title="Formas de pagamento" icon={<CreditCard className="h-4 w-4 text-[#9d2044]" />} values={profile.payment_methods} /></div>
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-[#eadedb] bg-[#fffdfc] p-3.5"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#9d2044]" /><p className="text-xs leading-5 text-slate-600">Informações e imagens passam por revisão antes da publicação.</p></div>
        {profile.contact_phone ? <a href={`https://wa.me/${profile.contact_phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#8e1839] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#8e1839]/20 transition hover:bg-[#700e2b] hover:shadow-xl active:scale-[.99]"><Phone className="h-4 w-4" />Conversar no WhatsApp</a> : <Link to="/explore" search={{ q: '', city: '', category: '' }} className="mt-6 flex w-full items-center justify-center rounded-2xl bg-[#8e1839] px-6 py-3.5 text-sm font-bold text-white">Voltar para a busca</Link>}
        {copied && <p className="mt-3 text-center text-xs font-semibold text-emerald-700">Link copiado.</p>}<a href="mailto:abuse@thesex.online?subject=Denúncia%20de%20perfil%20TheSex" className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-[#8e1839]"><Flag className="h-3.5 w-3.5" />Denunciar conteúdo ou uso indevido de imagem</a>
      </aside>
    </div>
  </div>
}

function DetailList({ title, icon, values }: { title: string; icon: ReactNode; values: string[] }) {
  if (values.length === 0) return null
  return <div><h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">{icon}{title}</h2><div className="mt-2 flex flex-wrap gap-2">{values.map(value => <span key={value} className="rounded-full bg-[#f7f0ee] px-3 py-1.5 text-xs font-medium text-slate-600">{value}</span>)}</div></div>
}

function NotFound() {
  return <div className="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#f7e9ed] text-[#8e1839]"><Sparkles className="h-6 w-6" /></div><h1 className="mt-5 text-2xl font-bold">Perfil não encontrado</h1><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Este perfil pode estar em revisão, ter sido pausado ou removido.</p><Link to="/explore" search={{ q: '', city: '', category: '' }} className="mt-6 rounded-xl bg-[#8e1839] px-5 py-3 text-sm font-bold text-white">Ver perfis publicados</Link></div>
}

function ProfileSkeleton() {
  return <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8"><div className="mb-6 h-5 w-40 animate-pulse rounded bg-[#f0e9e7]" /><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]"><div className="aspect-[4/5] animate-pulse rounded-[1.75rem] bg-[#f0e9e7] sm:aspect-[16/15]" /><div className="space-y-5 rounded-[1.75rem] border border-[#eadedb] bg-white p-6"><div className="h-4 w-28 animate-pulse rounded bg-[#f0e9e7]" /><div className="h-10 w-3/4 animate-pulse rounded bg-[#f0e9e7]" /><div className="h-20 animate-pulse rounded-2xl bg-[#f0e9e7]" /><div className="h-28 animate-pulse rounded-xl bg-[#f0e9e7]" /><div className="h-12 animate-pulse rounded-2xl bg-[#f0e9e7]" /></div></div></div>
}
