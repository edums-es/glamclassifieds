import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import { profilesApi, type Profile } from '@/lib/api'
import { Search, MapPin, Star, Crown, Sparkles, Filter, X, ArrowRight, Plus } from 'lucide-react'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'TheSex — Perfis verificados' },
      { name: 'description', content: 'Perfis publicados com curadoria, privacidade e discrição.' },
    ],
  }),
  component: Home,
})

function Home() {
  return (
    <main className="min-h-dvh bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden pt-24 pb-16 lg:pt-32 lg:pb-24">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground mb-6">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Diretório com curadoria
          </div>
          <h1 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-foreground">
            Encontre perfis <span className="text-primary">extraordinários</span>
            <br />
            perto de você
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Navegue por perfis publicados, filtre por cidade e encontre experiências com discrição e segurança.
          </p>
          <div className="mx-auto mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/create"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Anunciar perfil
            </Link>
            <Link
              to="."
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-secondary active:scale-[0.98]"
            >
              <Search className="h-4 w-4" />
              Explorar perfis
            </Link>
          </div>
        </div>
      </section>

      <MarketplaceContent />
    </main>
  )
}

function MarketplaceContent() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const loadProfiles = useCallback(async () => {
    setLoading(true)
    try {
      setProfiles(await profilesApi.list())
    } catch (err) {
      console.error('Failed to load profiles:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProfiles() }, [loadProfiles])

  const cities = [...new Set(profiles.map(p => p.city))].sort()
  const tags = [...new Set(profiles.flatMap(p => p.tags))].sort()

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.city.toLowerCase().includes(q) ||
      p.tags.some(tag => tag.toLowerCase().includes(q))
    const matchCity = !cityFilter || p.city === cityFilter
    return matchSearch && matchCity
  })

  const featured = filtered.filter(p => p.is_featured)
  const regular = filtered.filter(p => !p.is_featured)

  return (
    <>
      {/* Search + Filter Bar */}
      <section className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
              placeholder="Busque por nome, cidade ou interesse..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-full border border-input bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all ${
                cityFilter ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-foreground hover:bg-secondary'
              }`}
            >
              <Filter className="h-4 w-4" />
              Filtros
              {cityFilter && <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">1</span>}
            </button>
          </div>
          {showFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <span className="text-xs font-medium text-muted-foreground">Cidade:</span>
              {cityFilter && (
                <button onClick={() => setCityFilter('')} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  <X className="h-3 w-3" /> Limpar
                </button>
              )}
              {cities.map(city => (
                <button
                  key={city}
                  onClick={() => setCityFilter(city === cityFilter ? '' : city)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    city === cityFilter ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Row */}
      {featured.length > 0 && (
        <section className="py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-6 flex items-center gap-3">
              <Crown className="h-5 w-5 text-accent" />
              <h2 className="font-serif text-xl font-semibold text-foreground">Perfis em destaque</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map(p => (
                <ProfileCard key={p.id} profile={p} featured />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* All Profiles Grid */}
      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-foreground">
              Todos os perfis <span className="text-sm font-normal text-muted-foreground">({regular.length})</span>
            </h2>
          </div>
          {loading ? (
            <MarketplaceSkeleton />
          ) : regular.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20">
              <Search className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-4 text-muted-foreground">Nenhum perfil corresponde à busca.</p>
              <button onClick={() => { setSearch(''); setCityFilter('') }} className="mt-2 text-sm font-medium text-primary hover:underline">
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {regular.map(p => (
                <ProfileCard key={p.id} profile={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-muted-foreground">
            TheSex — Perfis independentes e publicados após análise.
          </p>
        </div>
      </footer>
    </>
  )
}

function ProfileCard({ profile, featured }: { profile: Profile; featured?: boolean }) {
  const mainPhoto = profile.photos[0] || ''

  return (
    <Link
      to="/profile/$id"
      params={{ id: profile.id }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
    >
      {/* Featured badge */}
      {featured && (
        <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-foreground shadow-sm">
          <Crown className="h-3 w-3" /> Destaque
        </div>
      )}
      {/* Photo */}
      <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
        {mainPhoto ? (
          <img
            src={mainPhoto}
            alt={profile.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Star className="h-8 w-8 opacity-30" />
          </div>
        )}
        {/* Price tag */}
        <div className="absolute bottom-3 left-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur-sm shadow-sm">
          {profile.price}
        </div>
      </div>
      {/* Info */}
      <div className="flex flex-col gap-1.5 p-4">
        <h3 className="font-serif text-base font-semibold text-foreground group-hover:text-primary transition-colors">
          {profile.name}
        </h3>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {profile.city}
          <span className="mx-1 opacity-30">·</span>
          {profile.age} anos
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {profile.tags.slice(0, 3).map(tag => (
            <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
              {tag}
            </span>
          ))}
          {profile.tags.length > 3 && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              +{profile.tags.length - 3}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

function MarketplaceSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8 h-7 w-40 rounded-lg bg-secondary animate-pulse" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="aspect-[3/4] bg-secondary animate-pulse" />
            <div className="p-4 space-y-2">
              <div className="h-5 w-28 rounded bg-secondary animate-pulse" />
              <div className="h-4 w-20 rounded bg-secondary animate-pulse" />
              <div className="flex gap-1">
                <div className="h-4 w-12 rounded-full bg-secondary animate-pulse" />
                <div className="h-4 w-14 rounded-full bg-secondary animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
