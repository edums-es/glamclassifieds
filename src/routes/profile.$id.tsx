import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { profilesApi, type Profile } from '@/lib/api'
import { SITE_URL } from '@/lib/seo-regions'
import { ArrowLeft, BadgeCheck, CheckCircle2, Flag, Heart, MapPin, Phone, Share2, ShieldCheck, Sparkles } from 'lucide-react'

export const Route = createFileRoute('/profile/$id')({
  head: ({ params }) => {
    const canonical = `${SITE_URL}/profile/${encodeURIComponent(params.id)}`
    return {
      meta: [
        { title: 'Perfil | TheSex' },
        { name: 'description', content: 'Informações, fotos e formas de contato de um perfil publicado.' },
        { name: 'robots', content: 'index,follow,max-image-preview:large' },
        { property: 'og:type', content: 'profile' },
        { property: 'og:url', content: canonical },
      ],
      links: [{ rel: 'canonical', href: canonical }],
    }
  },
  component: ProfilePage,
})

function ProfilePage() {
  const { id } = Route.useParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [liked, setLiked] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setProfile(await profilesApi.get(id)) }
    catch (error) { console.error('Não foi possível carregar o perfil:', error); setProfile(null) }
    finally { setLoading(false) }
  }, [id])
  useEffect(() => { void load() }, [load])

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: profile?.name ?? 'TheSex', url: window.location.href })
      else { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 2000) }
    } catch (error) { if ((error as Error).name !== 'AbortError') console.error('Não foi possível compartilhar:', error) }
  }

  if (loading) return <ProfileSkeleton />
  if (!profile) return <NotFound />

  const phone = profile.contact_phone.replace(/\D/g, '')
  const profileSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    url: `${SITE_URL}/profile/${encodeURIComponent(profile.id)}`,
    address: { '@type': 'PostalAddress', addressLocality: profile.city, addressCountry: 'BR' },
    description: profile.description,
    image: profile.photos,
  }).replace(/</g, '\\u003c')
  return <main className="min-h-dvh bg-[#fdfcfb] text-[#252429]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: profileSchema }} />
    <div className="h-1.5 bg-[#c51f69]" />
    <header className="border-b border-[#ece7e3] bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6"><Link to="/" className="text-lg font-black tracking-tight text-[#c51f69]">the<span className="text-[#28252a]">sex</span></Link><Link to="/create" className="rounded-md bg-[#438aca] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#3478b6]">PUBLICAR PERFIL</Link></div></header>
    <article className="mx-auto max-w-4xl px-4 pb-16 pt-5 sm:px-6">
      <Link to="/explore" search={{ q: '', city: '', category: '' }} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#c51f69] hover:underline"><ArrowLeft className="h-3.5 w-3.5" />Voltar para a busca</Link>
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[.04em] text-[#9a9192]">TheSex / {profile.category} / {profile.city}</p>

      <section className="mt-3 border border-[#e8e2df] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(31,24,27,.04)] sm:px-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-extrabold tracking-tight text-[#c51f69] sm:text-3xl">{profile.name}</h1>{profile.is_featured && <span className="rounded-full bg-[#fff1f7] px-2 py-1 text-[10px] font-bold text-[#c51f69]">DESTAQUE</span>}</div><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold text-[#625c60]"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-[#c51f69]" />{profile.city}{profile.neighborhood ? ` · ${profile.neighborhood}` : ''}</span><span>{profile.age} anos</span><span className="rounded border border-[#e5dedc] px-2 py-0.5 text-[10px] text-[#746c70]">{profile.category}</span></div></div><div className="flex items-center gap-2"><button aria-label={liked ? 'Remover dos favoritos' : 'Salvar nos favoritos'} onClick={() => setLiked(value => !value)} className={`grid h-8 w-8 place-items-center rounded-full border transition ${liked ? 'border-[#e89abb] bg-[#fff1f7] text-[#c51f69]' : 'border-[#e5dedc] text-[#7d7477] hover:text-[#c51f69]'}`}><Heart className={`h-3.5 w-3.5 ${liked ? 'fill-current' : ''}`} /></button><button aria-label="Compartilhar perfil" onClick={share} className="grid h-8 w-8 place-items-center rounded-full border border-[#e5dedc] text-[#7d7477] transition hover:text-[#c51f69]"><Share2 className="h-3.5 w-3.5" /></button></div></div>
        <p className="mt-4 border-t border-[#eee8e5] pt-4 text-sm font-semibold leading-6 text-[#353136]">{profile.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><span className="rounded bg-[#f8f5f3] px-2.5 py-1.5 font-bold text-[#5b5457]">{profile.price}</span>{profile.availability && <span className="rounded bg-[#f8f5f3] px-2.5 py-1.5 font-medium text-[#6c6467]">{profile.availability}</span>}</div>
      </section>

      <Gallery photos={profile.photos} profileName={profile.name} />

      <section className="mt-8 border-t border-[#e6dfdc] pt-5"><SectionTitle icon={<BadgeCheck className="h-4 w-4" />}>Sobre</SectionTitle><p className="mt-4 text-sm leading-7 text-[#5f585b]">{profile.description}</p>{profile.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{profile.tags.map(tag => <span key={tag} className="rounded border border-[#e7e0dd] bg-white px-2 py-1 text-[11px] font-medium text-[#676064]">{tag}</span>)}</div>}</section>
      <DetailSection title="Serviços" values={profile.services} />
      <DetailSection title="Atende" values={profile.service_for} />
      <DetailSection title="Local de atendimento" values={profile.meeting_places} />
      <DetailSection title="Formas de pagamento" values={profile.payment_methods} />

      <section className="mt-9 border-y border-[#e6dfdc] py-7 text-center"><p className="text-base font-bold text-[#3a3538]">Entre em contato</p><p className="mt-1 text-xs text-[#7a7175]">Converse diretamente e combine os detalhes com discrição.</p><div className="mx-auto mt-5 grid max-w-md gap-3 sm:grid-cols-2">{phone && <a href={`tel:+${phone}`} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#c51f69] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#ab1758]"><Phone className="h-3.5 w-3.5" />LIGAR</a>}{phone && <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-md bg-[#24c965] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#1bae56]"><Phone className="h-3.5 w-3.5" />WHATSAPP</a>}</div>{copied && <p className="mt-3 text-xs font-semibold text-emerald-700">Link copiado.</p>}</section>

      <div className="mt-6 border border-[#e7b2cc] bg-[#fffafd] px-4 py-3 text-xs leading-5 text-[#64585e]"><div className="flex items-center gap-2 font-bold text-[#c51f69]"><ShieldCheck className="h-4 w-4" />Canais de segurança</div><p className="mt-1">Informações e imagens passam por revisão antes da publicação. Use o canal de denúncia para reportar conteúdo ou uso indevido de imagem.</p></div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[11px] font-semibold text-[#81777b]"><span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-[#438aca]" />Perfil publicado após análise</span><a href="mailto:abuse@thesex.online?subject=Denúncia%20de%20perfil%20TheSex" className="inline-flex items-center gap-1 text-[#c51f69] hover:underline"><Flag className="h-3.5 w-3.5" />Reportar abuso ou golpe</a></div>
    </article>
  </main>
}

function Gallery({ photos, profileName }: { photos: string[]; profileName: string }) {
  if (photos.length === 0) return <section className="mt-5 grid aspect-[16/9] place-items-center border border-[#e8e2df] bg-[#f5f2f0] text-sm font-medium text-[#857b7e]"><Sparkles className="mb-2 h-5 w-5" />Fotos em atualização</section>
  return <section aria-label="Galeria de fotos" className={`mt-5 grid gap-px overflow-hidden border border-[#e8e2df] bg-[#e8e2df] ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3'}`}>{photos.map((photo, index) => <img key={photo} src={photo} alt={`Foto ${index + 1} de ${profileName}`} className={`w-full bg-[#f2eeeb] object-cover ${photos.length === 1 ? 'aspect-[16/10] max-h-[640px]' : 'aspect-[3/4]'}`} />)}</section>
}

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) { return <h2 className="flex items-center gap-2 text-base font-bold text-[#363136]"><span className="text-[#c51f69]">{icon}</span>{children}</h2> }
function DetailSection({ title, values }: { title: string; values: string[] }) { if (values.length === 0) return null; return <section className="mt-7 border-t border-[#e6dfdc] pt-5"><SectionTitle icon={<CheckCircle2 className="h-4 w-4" />}>{title}</SectionTitle><div className="mt-4 flex flex-wrap gap-2">{values.map(value => <span key={value} className="rounded border border-[#e7e0dd] bg-white px-2.5 py-1.5 text-xs font-medium text-[#635b5f]">{value}</span>)}</div></section> }
function ProfileSkeleton() { return <main className="min-h-dvh bg-[#fdfcfb]"><div className="h-1.5 bg-[#c51f69]" /><div className="mx-auto max-w-4xl px-4 py-10 sm:px-6"><div className="h-3 w-32 animate-pulse bg-[#eee9e6]" /><div className="mt-5 h-36 animate-pulse border border-[#ece6e3] bg-white" /><div className="mt-5 aspect-[16/10] animate-pulse bg-[#eee9e6]" /></div></main> }
function NotFound() { return <main className="grid min-h-dvh place-items-center bg-[#fdfcfb] px-4 text-center"><div><Sparkles className="mx-auto h-8 w-8 text-[#c51f69]" /><h1 className="mt-4 text-xl font-bold">Perfil não encontrado</h1><p className="mt-2 text-sm text-[#736a6e]">Este perfil pode estar em revisão ou ter sido pausado.</p><Link to="/explore" search={{ q: '', city: '', category: '' }} className="mt-5 inline-block rounded-md bg-[#438aca] px-4 py-2.5 text-xs font-bold text-white">VER PERFIS</Link></div></main> }
