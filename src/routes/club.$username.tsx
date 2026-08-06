import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ArrowLeft, BadgeCheck, CircleDollarSign, LockKeyhole, Sparkles } from 'lucide-react'
import { clubApi, type ClubCreator, type ClubPost } from '@/lib/api'

export const Route = createFileRoute('/club/$username')({ component: ClubChannelPage })

function ClubChannelPage() {
  const { username } = Route.useParams()
  const [creator, setCreator] = useState<ClubCreator | null>(null)
  const [posts, setPosts] = useState<ClubPost[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([clubApi.creator(username), clubApi.creatorPosts(username)])
      .then(([nextCreator, nextPosts]) => { setCreator(nextCreator); setPosts(nextPosts); void clubApi.track('creator_viewed', nextCreator.id) })
      .catch(() => setError('Este canal não está disponível.'))
  }, [username])

  if (error) return <main className="flex min-h-dvh items-center justify-center bg-[#120d16] px-4 text-center text-white"><div><h1 className="text-2xl font-black">Canal indisponível</h1><p className="mt-3 text-sm text-slate-400">O canal pode estar em análise ou não existir.</p><Link to="/club" className="mt-6 inline-flex rounded-xl bg-white px-4 py-3 text-sm font-black text-fuchsia-700">Voltar ao Club</Link></div></main>
  if (!creator) return <main className="min-h-dvh bg-[#120d16]"/>

  const price = creator.monthly_price_cents > 0 ? `R$ ${(creator.monthly_price_cents / 100).toFixed(2).replace('.', ',')} por mês` : 'Canal em preparação'
  return <main className="min-h-dvh bg-[#120d16] text-white"><header className="border-b border-white/10"><div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6"><Link to="/club" className="inline-flex items-center gap-2 text-sm font-black text-slate-300 hover:text-white"><ArrowLeft className="h-4 w-4"/>Todos os canais</Link><Link to="/" className="font-black text-fuchsia-300">thesex club</Link></div></header><section className="relative overflow-hidden border-b border-white/10"><div className="absolute inset-0 bg-gradient-to-br from-fuchsia-800/70 via-violet-950 to-[#120d16]"/>{creator.cover_photo && <img src={creator.cover_photo} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20"/>}<div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20"><p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-black uppercase tracking-[.15em] text-fuchsia-100"><BadgeCheck className="h-3.5 w-3.5"/>Canal verificado</p><h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">{creator.display_name}</h1><p className="mt-5 max-w-2xl text-base leading-7 text-slate-200">{creator.bio || 'Canal exclusivo vinculado a um perfil aprovado.'}</p><div className="mt-8 flex flex-wrap items-center gap-3"><button onClick={() => void clubApi.track('subscribe_intent', creator.id)} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-fuchsia-800"><CircleDollarSign className="h-4 w-4"/>{price}</button>{creator.profile_url && <a href={creator.profile_url} className="rounded-xl border border-white/25 px-5 py-3 text-sm font-black hover:bg-white/10">Ver perfil público</a>}</div></div></section><section className="mx-auto max-w-5xl px-4 py-14 sm:px-6"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-fuchsia-300"/><h2 className="text-2xl font-black">Publicações abertas</h2></div>{posts.length === 0 ? <div className="mt-6 rounded-3xl border border-dashed border-white/15 p-10 text-center text-sm text-slate-400"><LockKeyhole className="mx-auto h-7 w-7 text-fuchsia-300"/><p className="mt-3">Este canal ainda não possui publicações abertas.</p></div> : <div className="mt-6 grid gap-4 sm:grid-cols-2">{posts.map(post => <article key={post.id} className="rounded-3xl border border-white/10 bg-white/[.04] p-6"><p className="text-sm leading-6 text-slate-200">{post.caption}</p><button onClick={() => void clubApi.track('post_opened', creator.id, post.id)} className="mt-5 text-xs font-black text-fuchsia-200">Abrir publicação</button></article>)}</div>}</section></main>
}
