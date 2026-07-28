import { createFileRoute, Link } from '@tanstack/react-router'
import { Check, CircleAlert, Eye, EyeOff, Loader2, LogOut, RefreshCw, ShieldCheck, Star, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { adminApi, type Admin, type ModerationProfile, type ProfileStatus } from '@/lib/api'

const STATUS_OPTIONS: { value: ProfileStatus; label: string }[] = [
  { value: 'pending', label: 'Pendentes' },
  { value: 'active', label: 'Publicados' },
  { value: 'rejected', label: 'Recusados' },
  { value: 'archived', label: 'Arquivados' },
]

export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [
      { title: 'Administração · TheSex' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: AdminPage,
})

function AdminPage() {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [status, setStatus] = useState<ProfileStatus>('pending')
  const [profiles, setProfiles] = useState<ModerationProfile[]>([])
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const loadProfiles = async (requestedStatus = status) => {
    setLoading(true)
    setError('')
    try {
      setProfiles(await adminApi.listProfiles(requestedStatus))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a fila.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    adminApi.me()
      .then(currentAdmin => {
        setAdmin(currentAdmin)
        return loadProfiles('pending')
      })
      .catch(() => setAdmin(null))
      .finally(() => setChecking(false))
  }, [])

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const currentAdmin = await adminApi.login(email, password)
      setAdmin(currentAdmin)
      setPassword('')
      await loadProfiles('pending')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (nextStatus: ProfileStatus) => {
    setStatus(nextStatus)
    await loadProfiles(nextStatus)
  }

  const updateProfile = async (profile: ModerationProfile, nextStatus: ProfileStatus, featured = profile.is_featured) => {
    setSavingId(profile.id)
    setError('')
    try {
      await adminApi.updateProfile(profile.id, { status: nextStatus, is_featured: featured })
      await loadProfiles(status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar o perfil.')
    } finally {
      setSavingId(null)
    }
  }

  const logout = async () => {
    try {
      await adminApi.logout()
    } finally {
      setAdmin(null)
      setProfiles([])
      setError('')
    }
  }

  if (checking) {
    return <LoadingScreen />
  }

  if (!admin) {
    return (
      <main className="min-h-dvh bg-muted/30 px-4 py-10 sm:py-16">
        <section className="mx-auto max-w-md rounded-3xl border border-border bg-card p-7 shadow-sm sm:p-9">
          <Link to="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">← Voltar ao site</Link>
          <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-5 font-serif text-3xl font-bold text-foreground">Área administrativa</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Acesse a fila privada para analisar perfis enviados.</p>

          <form className="mt-8 space-y-4" onSubmit={handleLogin}>
            <label className="block text-sm font-semibold text-foreground">
              E-mail
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 font-normal outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                required
              />
            </label>
            <label className="block text-sm font-semibold text-foreground">
              Senha
              <span className="relative mt-1.5 block">
                <input
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 pr-11 font-normal outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                  required
                />
                <button type="button" onClick={() => setPasswordVisible(value => !value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground" aria-label={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'}>
                  {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>
            {error && <ErrorNotice message={error} />}
            <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Entrar
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-muted/30">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><ShieldCheck className="h-4 w-4" /> Administração</p>
            <h1 className="mt-1 font-serif text-2xl font-bold text-foreground">Moderação de perfis</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-right text-xs text-muted-foreground sm:block">{admin.email}</span>
            <button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(option => (
              <button key={option.value} type="button" onClick={() => handleStatusChange(option.value)} className={`rounded-full px-3 py-2 text-sm font-medium transition ${status === option.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                {option.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => loadProfiles()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>

        {error && <div className="mt-5"><ErrorNotice message={error} /></div>}

        {loading && profiles.length === 0 ? (
          <LoadingScreen compact />
        ) : profiles.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <ShieldCheck className="mx-auto h-9 w-9 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">Nenhum perfil nesta fila</h2>
            <p className="mt-1 text-sm text-muted-foreground">Novos envios aparecerão aqui para sua análise.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {profiles.map(profile => <ProfileCard key={profile.id} profile={profile} saving={savingId === profile.id} onUpdate={updateProfile} />)}
          </div>
        )}
      </section>
    </main>
  )
}

function ProfileCard({ profile, saving, onUpdate }: { profile: ModerationProfile; saving: boolean; onUpdate: (profile: ModerationProfile, status: ProfileStatus, featured?: boolean) => Promise<void> }) {
  const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(profile.created_at.replace(' ', 'T') + 'Z'))
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card sm:flex">
      <div className="h-48 bg-muted sm:h-auto sm:w-52">
        {profile.photos[0] ? <img src={profile.photos[0]} alt={`Foto de ${profile.name}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem foto</div>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">{profile.name}, {profile.age}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{profile.city} · {profile.price} · Enviado em {date}</p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold capitalize text-muted-foreground">{profile.status}</span>
        </div>
        {profile.description && <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">{profile.description}</p>}
        {profile.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{profile.tags.map(tag => <span key={tag} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{tag}</span>)}</div>}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
          {profile.status !== 'active' && <ActionButton disabled={saving} onClick={() => onUpdate(profile, 'active', profile.is_featured)} tone="positive"><Check className="h-4 w-4" /> Publicar</ActionButton>}
          {profile.status !== 'rejected' && <ActionButton disabled={saving} onClick={() => onUpdate(profile, 'rejected', false)} tone="danger"><X className="h-4 w-4" /> Recusar</ActionButton>}
          {profile.status === 'active' && <ActionButton disabled={saving} onClick={() => onUpdate(profile, 'active', !profile.is_featured)} tone={profile.is_featured ? 'neutral' : 'highlight'}><Star className={`h-4 w-4 ${profile.is_featured ? 'fill-current' : ''}`} /> {profile.is_featured ? 'Remover destaque' : 'Destacar'}</ActionButton>}
          {profile.status !== 'archived' && <ActionButton disabled={saving} onClick={() => onUpdate(profile, 'archived', false)} tone="neutral">Arquivar</ActionButton>}
          {saving && <span className="inline-flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Salvando</span>}
        </div>
      </div>
    </article>
  )
}

function ActionButton({ children, disabled, onClick, tone }: { children: ReactNode; disabled: boolean; onClick: () => void; tone: 'positive' | 'danger' | 'highlight' | 'neutral' }) {
  const classes = {
    positive: 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700',
    danger: 'border-destructive/30 text-destructive hover:bg-destructive/5',
    highlight: 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
    neutral: 'border-border text-foreground hover:bg-muted',
  }
  return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${classes[tone]}`}>{children}</button>
}

function ErrorNotice({ message }: { message: string }) {
  return <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{message}</div>
}

function LoadingScreen({ compact = false }: { compact?: boolean }) {
  return <div className={`flex items-center justify-center ${compact ? 'min-h-52' : 'min-h-dvh bg-muted/30'}`}><Loader2 className="h-7 w-7 animate-spin text-primary" /><span className="ml-3 text-sm text-muted-foreground">Carregando…</span></div>
}
