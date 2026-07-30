import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { profilesApi, type Profile } from '@/lib/api'
import { ArrowLeft, MapPin, Star, Shield, Heart, Share2, Crown, Phone, Clock3 } from 'lucide-react'

export const Route = createFileRoute('/profile/$id')({
  head: ({ params }) => ({
    meta: [
      { title: 'Perfil · TheSex' },
      { name: 'description', content: 'Conheça este perfil publicado no TheSex.' },
    ],
  }),
  component: ProfilePage,
})

function ProfilePage() {
  return (
    <main className="min-h-dvh bg-background">
      <ProfileContent />
    </main>
  )
}

function ProfileContent() {
  const { id } = Route.useParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePhoto, setActivePhoto] = useState(0)
  const [liked, setLiked] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      setProfile(await profilesApi.get(id))
    } catch (err) {
      console.error('Failed to load profile:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadProfile() }, [loadProfile])

  if (loading) return <ProfileSkeleton />
  if (!profile) return <NotFound />

  const photos = profile.photos
  const tags = profile.tags
  const isFeatured = profile.is_featured

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Back nav */}
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Voltar ao diretório
      </Link>

      {/* Hero photo area */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="relative overflow-hidden rounded-2xl border border-border bg-secondary aspect-[4/5]">
            {photos[activePhoto] ? (
              <img
                src={photos[activePhoto]}
                alt={`${profile.name} photo ${activePhoto + 1}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Star className="h-12 w-12 opacity-20" />
              </div>
            )}
            {isFeatured && (
              <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-bold text-accent-foreground shadow-md">
                <Crown className="h-4 w-4" /> Destaque
              </div>
            )}
          </div>
          {/* Thumbnail strip */}
          {photos.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {photos.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhoto(i)}
                  className={`relative h-20 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                    i === activePhoto ? 'border-primary shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={url} alt={`Thumb ${i + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{profile.category}</p>
              <h1 className="mt-1 font-serif text-2xl font-bold text-foreground">{profile.name}</h1>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {profile.city}{profile.neighborhood ? ` · ${profile.neighborhood}` : ''}
                <span className="opacity-30">·</span>
                {profile.age} anos
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setLiked(!liked)}
                className={`rounded-full border p-2 transition-all ${
                  liked ? 'border-red-200 bg-red-50 text-red-500' : 'border-border bg-card text-muted-foreground hover:border-red-200 hover:text-red-400'
                }`}
              >
                <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
              </button>
              <button className="rounded-full border border-border bg-card p-2 text-muted-foreground hover:text-foreground transition-colors">
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Price */}
          <div className="mt-5 rounded-xl bg-secondary px-4 py-3">
            <span className="text-xs font-medium text-muted-foreground">Valor</span>
            <p className="mt-0.5 text-xl font-bold text-foreground">{profile.price}</p>
          </div>

          {/* Tags */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {tags.map(tag => (
              <span key={tag} className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>

          {/* Description */}
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-foreground">Sobre</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{profile.description}</p>
          </div>

          {profile.availability && <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="h-4 w-4 text-primary" /> {profile.availability}</div>}

          {/* Verified badge */}
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-card p-3">
            <Shield className="h-4 w-4 text-accent" />
            <span className="text-xs font-medium text-muted-foreground">Perfil publicado após análise</span>
          </div>

          {/* CTA */}
          {profile.contact_phone ? <a href={`https://wa.me/${profile.contact_phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]"><Phone className="h-4 w-4" /> Contatar {profile.name.split(' ')[0]}</a> : <Link to="/" className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]">Voltar à vitrine</Link>}
        </div>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center">
      <Star className="h-12 w-12 text-muted-foreground/30" />
      <h2 className="mt-4 text-lg font-semibold text-foreground">Perfil não encontrado</h2>
      <p className="mt-1 text-sm text-muted-foreground">Este perfil pode ter sido removido.</p>
      <Link to="/" className="mt-4 text-sm font-medium text-primary hover:underline">
        Voltar ao diretório
      </Link>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 h-5 w-32 rounded bg-secondary animate-pulse" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="aspect-[4/5] rounded-2xl bg-secondary animate-pulse" />
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="h-8 w-48 rounded bg-secondary animate-pulse" />
          <div className="h-5 w-32 rounded bg-secondary animate-pulse" />
          <div className="h-16 rounded-xl bg-secondary animate-pulse" />
          <div className="flex gap-2">
            <div className="h-6 w-16 rounded-full bg-secondary animate-pulse" />
            <div className="h-6 w-20 rounded-full bg-secondary animate-pulse" />
            <div className="h-6 w-14 rounded-full bg-secondary animate-pulse" />
          </div>
          <div className="h-24 rounded-lg bg-secondary animate-pulse" />
          <div className="h-12 rounded-full bg-secondary animate-pulse" />
        </div>
      </div>
    </div>
  )
}
