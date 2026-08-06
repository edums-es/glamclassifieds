import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CircleAlert,
  Clock3,
  Eye,
  EyeOff,
  FileClock,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  UserRoundCheck,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { adminApi, clubApi, type Admin, type AdminMember, type AdminMetrics, type AuditLog, type ModerationProfile, type ProfileStatus } from '@/lib/api'

const STATUS_OPTIONS: { value: ProfileStatus; label: string; description: string; tone: string }[] = [
  { value: 'pending', label: 'Para revisar', description: 'Aguardando análise', tone: 'bg-amber-50 text-amber-800 ring-amber-200' },
  { value: 'active', label: 'Publicados', description: 'Visíveis ao público', tone: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  { value: 'rejected', label: 'Recusados', description: 'Precisam de ajuste', tone: 'bg-rose-50 text-rose-800 ring-rose-200' },
  { value: 'archived', label: 'Arquivados', description: 'Fora da vitrine', tone: 'bg-slate-100 text-slate-700 ring-slate-200' },
]

const EMPTY_PROFILES: Record<ProfileStatus, ModerationProfile[]> = {
  pending: [], active: [], rejected: [], archived: [],
}

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
  const [activeSection, setActiveSection] = useState<'overview' | 'queue' | 'members' | 'activity' | 'security' | 'tso-dashboard' | 'tso-creators' | 'tso-posts' | 'tso-orders'>('overview')
  const [status, setStatus] = useState<ProfileStatus>('pending')
  const [profilesByStatus, setProfilesByStatus] = useState<Record<ProfileStatus, ModerationProfile[]>>(EMPTY_PROFILES)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [members, setMembers] = useState<AdminMember[]>([])
  const [memberQuery, setMemberQuery] = useState('')
  const [query, setQuery] = useState('')
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')

  const loadWorkspace = async () => {
    setLoading(true)
    setError('')
    try {
      const [pending, active, rejected, archived, audit, nextMetrics, nextMembers] = await Promise.all([
        adminApi.listProfiles('pending'),
        adminApi.listProfiles('active'),
        adminApi.listProfiles('rejected'),
        adminApi.listProfiles('archived'),
        adminApi.audit().catch(() => []),
        adminApi.metrics(),
        adminApi.members(),
      ])
      setProfilesByStatus({ pending, active, rejected, archived })
      setAuditLogs(audit)
      setMetrics(nextMetrics)
      setMembers(nextMembers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a central administrativa.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    adminApi.me()
      .then(currentAdmin => {
        setAdmin(currentAdmin)
        return loadWorkspace()
      })
      .catch(() => setAdmin(null))
      .finally(() => setChecking(false))
  }, [])

  useEffect(() => {
    const refreshTimer = window.setInterval(() => { if (admin) void loadWorkspace() }, 30000)
    return () => window.clearInterval(refreshTimer)
  }, [admin])

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const currentAdmin = await adminApi.login(email, password)
      setAdmin(currentAdmin)
      setPassword('')
      await loadWorkspace()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
      setLoading(false)
    }
  }

  const updateProfile = async (profile: ModerationProfile, nextStatus: ProfileStatus, featured = profile.is_featured, moderationNote = profile.moderation_note, autoApproved = profile.auto_approved) => {
    setSavingId(profile.id)
    setError('')
    try {
      await adminApi.updateProfile(profile.id, { status: nextStatus, is_featured: featured, moderationNote, autoApproved })
      await loadWorkspace()
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
      setProfilesByStatus(EMPTY_PROFILES)
      setAuditLogs([])
      setMembers([])
      setMetrics(null)
      setError('')
    }
  }

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setPasswordMessage('')
    if (newPassword.length < 12) {
      setPasswordMessage('A nova senha precisa ter pelo menos 12 caracteres.')
      return
    }
    setLoading(true)
    try {
      await adminApi.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setPasswordMessage('Senha atualizada com sucesso.')
      await loadWorkspace()
    } catch (err) {
      setPasswordMessage(err instanceof Error ? err.message : 'Não foi possível atualizar a senha.')
      setLoading(false)
    }
  }

  const counts = useMemo(() => ({
    pending: profilesByStatus.pending.length,
    active: profilesByStatus.active.length,
    rejected: profilesByStatus.rejected.length,
    archived: profilesByStatus.archived.length,
    featured: profilesByStatus.active.filter(profile => profile.is_featured).length,
  }), [profilesByStatus])

  const queuedProfiles = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR')
    if (!term) return profilesByStatus[status]
    return profilesByStatus[status].filter(profile => [profile.name, profile.city, profile.neighborhood, profile.category, profile.contact_phone].join(' ').toLocaleLowerCase('pt-BR').includes(term))
  }, [profilesByStatus, query, status])

  const latestProfiles = useMemo(() => Object.values(profilesByStatus).flat().sort((left, right) => right.created_at.localeCompare(left.created_at)).slice(0, 5), [profilesByStatus])

  if (checking) return <LoadingScreen />
  if (!admin) return <AdminLogin email={email} password={password} passwordVisible={passwordVisible} loading={loading} error={error} onEmail={setEmail} onPassword={setPassword} onVisible={() => setPasswordVisible(value => !value)} onSubmit={handleLogin} />

  const navItems: { id: typeof activeSection; label: string; icon: typeof LayoutDashboard; badge?: number }[] = [
    { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
    { id: 'queue', label: 'Moderação', icon: ShieldCheck, badge: counts.pending },
    { id: 'members', label: 'Contas', icon: Users, badge: metrics?.members },
    { id: 'activity', label: 'Atividade', icon: Activity },
    { id: 'security', label: 'Segurança', icon: LockKeyhole },
  ]

  const tsoNavItems: { id: typeof activeSection; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'tso-dashboard', label: 'Visão do Club', icon: LayoutDashboard },
    { id: 'tso-creators', label: 'Creators', icon: Users },
    { id: 'tso-posts', label: 'Posts (PPV)', icon: ImageIcon },
    { id: 'tso-orders', label: 'Vendas', icon: BadgeCheck },
  ]

  return (
    <main className="min-h-dvh bg-[#f5f5f7] text-slate-900">
      <div className="min-h-dvh lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-[#111218] px-4 py-4 text-slate-100 lg:min-h-dvh lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
          <div className="flex items-center justify-between px-2">
            <Link to="/" className="group flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-rose-600 shadow-lg shadow-fuchsia-950/30"><ShieldCheck className="h-5 w-5" /></span>
              <span><strong className="block text-base tracking-tight">thesex</strong><small className="block text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Painel operacional</small></span>
            </Link>
            <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">online</span>
          </div>

          <nav className="mt-7 flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
            {navItems.map(item => {
              const Icon = item.icon
              const active = activeSection === item.id
              return <button key={item.id} type="button" onClick={() => setActiveSection(item.id)} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition lg:w-full ${active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400 hover:bg-white/8 hover:text-white'}`}>
                <Icon className="h-4.5 w-4.5" />{item.label}
                {item.badge ? <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${active ? 'bg-rose-100 text-rose-700' : 'bg-rose-500/20 text-rose-200'}`}>{item.badge}</span> : null}
              </button>
            })}
          </nav>

          <div className="mt-8 mb-2 px-3">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-fuchsia-500">TheSex Club</p>
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
            {tsoNavItems.map(item => {
              const Icon = item.icon
              const active = activeSection === item.id
              return <button key={item.id} type="button" onClick={() => setActiveSection(item.id)} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition lg:w-full ${active ? 'bg-fuchsia-600 text-white shadow-sm' : 'text-fuchsia-200 hover:bg-white/8 hover:text-white'}`}>
                <Icon className="h-4.5 w-4.5" />{item.label}
              </button>
            })}
          </nav>

          <div className="mt-7 hidden rounded-2xl border border-white/8 bg-white/[.035] p-4 lg:block">
            <p className="text-xs font-semibold text-slate-300">Moderação responsável</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Revise fotos, dados e descrição antes da publicação. Registre o motivo quando houver recusa.</p>
          </div>

          <div className="mt-5 border-t border-white/10 pt-4 lg:absolute lg:bottom-6 lg:left-4 lg:right-4">
            <p className="truncate px-2 text-xs text-slate-500">{admin.email}</p>
            <button type="button" onClick={logout} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-400 transition hover:bg-white/8 hover:text-white"><LogOut className="h-4.5 w-4.5" /> Encerrar sessão</button>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#f5f5f7]/90 px-5 py-4 backdrop-blur lg:px-9">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.17em] text-fuchsia-700">Central de confiança</p>
                <h1 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">{activeSection === 'overview' ? 'Visão geral' : activeSection === 'queue' ? 'Fila de moderação' : activeSection === 'members' ? 'Contas e proprietários' : activeSection === 'activity' ? 'Histórico operacional' : activeSection.startsWith('tso-') ? 'TheSex Club' : 'Segurança da conta'}</h1>
              </div>
              <button type="button" onClick={() => void loadWorkspace()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold shadow-sm transition hover:border-slate-400 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">Atualizar dados</span></button>
            </div>
          </header>

          <section className="mx-auto max-w-7xl px-5 py-7 lg:px-9 lg:py-9">
            {error && <div className="mb-5"><ErrorNotice message={error} /></div>}
            {activeSection === 'overview' && <Overview counts={counts} metrics={metrics} profiles={latestProfiles} loading={loading} onModerate={() => setActiveSection('queue')} onActivity={() => setActiveSection('activity')} />}
            {activeSection === 'queue' && <ModerationQueue status={status} query={query} profiles={queuedProfiles} total={profilesByStatus[status].length} savingId={savingId} loading={loading} onStatus={setStatus} onQuery={setQuery} onUpdate={updateProfile} />}
            {activeSection === 'members' && <MembersPanel members={members} query={memberQuery} loading={loading} onQuery={setMemberQuery} onReload={async (value) => { setLoading(true); try { setMembers(await adminApi.members(value)) } finally { setLoading(false) } }} onSave={async (member, values) => { await adminApi.updateMember(member.id, values); await loadWorkspace() }} />}
            {activeSection === 'activity' && <ActivityPanel logs={auditLogs} loading={loading} onRefresh={() => void loadWorkspace()} />}
            {activeSection === 'security' && <SecurityPanel currentPassword={currentPassword} newPassword={newPassword} message={passwordMessage} loading={loading} onCurrent={setCurrentPassword} onNew={setNewPassword} onSubmit={changePassword} />}
            
            {activeSection === 'tso-dashboard' && <TsoDashboard />}
            {activeSection === 'tso-creators' && <TsoCreators />}
            {activeSection === 'tso-posts' && <TsoPosts />}
            {activeSection === 'tso-orders' && <TsoOrders />}
          </section>
        </div>
      </div>
    </main>
  )
}

function Overview({ counts, metrics: adminMetrics, profiles, loading, onModerate, onActivity }: { counts: Record<ProfileStatus | 'featured', number>; metrics: AdminMetrics | null; profiles: ModerationProfile[]; loading: boolean; onModerate: () => void; onActivity: () => void }) {
  const metrics = [
    { label: 'Aguardando análise', value: counts.pending, hint: counts.pending ? 'Ação necessária' : 'Fila em dia', icon: FileClock, color: 'text-amber-600 bg-amber-50' },
    { label: 'Perfis publicados', value: counts.active, hint: `${counts.featured} em destaque`, icon: UserRoundCheck, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Recusados', value: counts.rejected, hint: 'Com retorno enviado', icon: ShieldAlert, color: 'text-rose-600 bg-rose-50' },
    { label: 'Arquivados', value: counts.archived, hint: 'Fora da vitrine', icon: Users, color: 'text-slate-600 bg-slate-100' },
  ]
  return <div className="space-y-7">
    <div className="overflow-hidden rounded-3xl bg-[#17131c] p-6 text-white shadow-xl shadow-slate-950/10 sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><span className="inline-flex items-center gap-2 rounded-full bg-fuchsia-500/15 px-3 py-1 text-xs font-bold text-fuchsia-200"><Sparkles className="h-3.5 w-3.5" /> Central de moderação</span><h2 className="mt-4 max-w-xl text-2xl font-extrabold tracking-tight sm:text-3xl">Operação segura, perfis consistentes e uma vitrine confiável.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Acompanhe o volume real da plataforma e resolva primeiro os perfis que aguardam sua decisão.</p></div>
        <button type="button" onClick={onModerate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-fuchsia-50"><ShieldCheck className="h-4 w-4 text-fuchsia-700" /> Revisar fila{counts.pending ? ` (${counts.pending})` : ''}</button>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(metric => { const Icon = metric.icon; return <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-slate-500">{metric.label}</p><p className="mt-3 text-3xl font-extrabold tracking-tight">{loading ? '—' : metric.value}</p></div><span className={`rounded-xl p-2.5 ${metric.color}`}><Icon className="h-5 w-5" /></span></div><p className="mt-3 text-xs font-medium text-slate-500">{metric.hint}</p></article> })}</div>
    <div className="grid gap-3 md:grid-cols-3"><article className="rounded-2xl bg-fuchsia-950 p-5 text-white"><p className="text-xs font-bold uppercase tracking-[.12em] text-pink-200">Novos hoje</p><p className="mt-2 text-3xl font-black">{adminMetrics?.submitted_today ?? '—'}</p><p className="mt-1 text-xs text-pink-200">Envios nas últimas 24h</p></article><article className="rounded-2xl bg-slate-900 p-5 text-white"><p className="text-xs font-bold uppercase tracking-[.12em] text-slate-300">Últimos 7 dias</p><p className="mt-2 text-3xl font-black">{adminMetrics?.submitted_last_7_days ?? '—'}</p><p className="mt-1 text-xs text-slate-300">Cadastros recebidos</p></article><article className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-amber-800">Autoaprovação</p><p className="mt-2 text-3xl font-black text-amber-950">{adminMetrics?.auto_approved ?? '—'}</p><p className="mt-1 text-xs text-amber-800">Perfis com fluxo automático</p></article></div>
    <div className="grid gap-6 xl:grid-cols-[1.45fr_.85fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-extrabold">Entradas recentes</p><p className="mt-1 text-xs text-slate-500">Últimos perfis registrados na plataforma.</p></div><button type="button" onClick={onModerate} className="inline-flex items-center gap-1 text-xs font-bold text-fuchsia-700 hover:text-fuchsia-900">Abrir fila <ArrowUpRight className="h-3.5 w-3.5" /></button></div>{profiles.length === 0 ? <EmptyState icon={FileClock} title="Ainda não há perfis" text="Os novos cadastros aparecerão aqui assim que forem enviados." compact /> : <div className="mt-5 divide-y divide-slate-100">{profiles.map(profile => <RecentProfile key={profile.id} profile={profile} />)}</div>}</section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><span className="rounded-lg bg-violet-50 p-2 text-violet-700"><Activity className="h-4 w-4" /></span><div><p className="text-sm font-extrabold">Disciplina operacional</p><p className="text-xs text-slate-500">Próximas prioridades</p></div></div><ol className="mt-5 space-y-4">{[['1','Revise a fila pendente','Cheque foto, idade, texto e dados de contato.'],['2','Registre decisões','Use a nota para orientar ajustes em recusas.'],['3','Destaque com critério','Use destaque apenas em perfis consistentes.']].map(([number,title,text]) => <li key={number} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-extrabold text-slate-600">{number}</span><div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></li>)}</ol><button type="button" onClick={onActivity} className="mt-6 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Ver trilha de auditoria</button></section>
    </div>
  </div>
}

function ModerationQueue({ status, query, profiles, total, savingId, loading, onStatus, onQuery, onUpdate }: { status: ProfileStatus; query: string; profiles: ModerationProfile[]; total: number; savingId: string | null; loading: boolean; onStatus: (status: ProfileStatus) => void; onQuery: (value: string) => void; onUpdate: (profile: ModerationProfile, status: ProfileStatus, featured?: boolean, moderationNote?: string, autoApproved?: boolean) => Promise<void> }) {
  const selected = STATUS_OPTIONS.find(option => option.value === status)!
  return <div className="space-y-5">
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">{STATUS_OPTIONS.map(option => <button key={option.value} type="button" onClick={() => onStatus(option.value)} className={`rounded-xl px-3 py-2 text-sm font-bold transition ${status === option.value ? 'bg-slate-950 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{option.label}</button>)}</div>
        <label className="relative block w-full xl:w-80"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={query} onChange={event => onQuery(event.target.value)} placeholder="Buscar nome, cidade ou contato" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-fuchsia-400 focus:bg-white focus:ring-4 focus:ring-fuchsia-100"/></label>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><div><h2 className="text-base font-extrabold">{selected.label}</h2><p className="mt-0.5 text-xs text-slate-500">{selected.description}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${selected.tone}`}>{total} no total</span></div>
    </div>
    {loading && profiles.length === 0 ? <LoadingScreen compact /> : profiles.length === 0 ? <EmptyState icon={query ? Search : ShieldCheck} title={query ? 'Nada encontrado' : 'Fila limpa'} text={query ? 'Tente outro nome, cidade ou telefone.' : 'Não há perfis neste status agora.'} /> : <div className="grid gap-4">{profiles.map(profile => <ProfileCard key={profile.id} profile={profile} saving={savingId === profile.id} onUpdate={onUpdate} />)}</div>}
  </div>
}

function RecentProfile({ profile }: { profile: ModerationProfile }) { const option = STATUS_OPTIONS.find(item => item.value === profile.status)!; return <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><div className="h-10 w-10 overflow-hidden rounded-xl bg-slate-100">{profile.photos[0] ? <img src={profile.photos[0]} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-slate-400"><ImageIcon className="h-4 w-4" /></span>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{profile.name}</p><p className="truncate text-xs text-slate-500">{profile.city} · {profile.category}</p></div><span className={`hidden rounded-full px-2 py-1 text-[10px] font-bold ring-1 sm:inline ${option.tone}`}>{option.label}</span></div> }

function ProfileCard({ profile, saving, onUpdate }: { profile: ModerationProfile; saving: boolean; onUpdate: (profile: ModerationProfile, status: ProfileStatus, featured?: boolean, moderationNote?: string, autoApproved?: boolean) => Promise<void> }) {
  const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(profile.created_at.replace(' ', 'T') + 'Z'))
  const [moderationNote, setModerationNote] = useState(profile.moderation_note ?? '')
  const option = STATUS_OPTIONS.find(item => item.value === profile.status)!
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="grid md:grid-cols-[210px_minmax(0,1fr)]"><div className="relative min-h-52 bg-slate-100">{profile.photos[0] ? <img src={profile.photos[0]} alt={`Foto enviada por ${profile.name}`} className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400"><ImageIcon className="h-7 w-7"/><span className="text-xs font-semibold">Sem foto enviada</span></div>}<span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 backdrop-blur ${option.tone}`}>{option.label}</span></div><div className="p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-extrabold tracking-tight">{profile.name}, {profile.age}</h2>{profile.is_featured && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800"><Star className="h-3 w-3 fill-current"/> Destaque</span>}</div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-500"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-fuchsia-600"/>{profile.city}{profile.neighborhood ? ` · ${profile.neighborhood}` : ''}</span><span>{profile.category}</span><span>{profile.price}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5"/> {profile.availability || 'Disponibilidade não informada'}</span></div></div><p className="shrink-0 text-xs text-slate-400">Enviado em {date}</p></div>
  {profile.member_email && <p className="mt-3 text-xs font-bold text-slate-500">Conta proprietária: {profile.member_email}</p>}{profile.description && <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-600">{profile.description}</p>}
  <div className="mt-4 flex flex-wrap gap-2">{profile.services.slice(0, 4).map(item => <span key={item} className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{item}</span>)}{profile.tags.slice(0, 4).map(tag => <span key={tag} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500">#{tag}</span>)}</div>
  <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2"><span className="inline-flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400"/>{profile.contact_phone || 'Sem telefone'}</span><span className="inline-flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5 text-slate-400"/>{profile.photos.length} foto{profile.photos.length === 1 ? '' : 's'} enviada{profile.photos.length === 1 ? '' : 's'}</span></div>
  <label className="mt-4 block text-xs font-bold text-slate-700">Nota interna / retorno para o perfil<textarea value={moderationNote} onChange={event => setModerationNote(event.target.value)} rows={2} placeholder="Ex.: Reenvie a foto principal com melhor resolução." className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none transition focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-100"/></label>
  <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">{profile.status !== 'active' && <ActionButton disabled={saving} onClick={() => onUpdate(profile, 'active', profile.is_featured, moderationNote)} tone="positive"><Check className="h-4 w-4"/> Publicar perfil</ActionButton>}{profile.status !== 'rejected' && <ActionButton disabled={saving} onClick={() => onUpdate(profile, 'rejected', false, moderationNote)} tone="danger"><X className="h-4 w-4"/> Recusar</ActionButton>}{profile.status === 'active' && <ActionButton disabled={saving} onClick={() => onUpdate(profile, 'active', !profile.is_featured, moderationNote)} tone={profile.is_featured ? 'neutral' : 'highlight'}><Star className={`h-4 w-4 ${profile.is_featured ? 'fill-current' : ''}`}/>{profile.is_featured ? 'Remover destaque' : 'Dar destaque'}</ActionButton>}<ActionButton disabled={saving} onClick={() => onUpdate(profile, profile.status, profile.is_featured, moderationNote, !profile.auto_approved)} tone={profile.auto_approved ? 'highlight' : 'neutral'}><Sparkles className="h-4 w-4"/>{profile.auto_approved ? 'Autoaprovação ativa' : 'Ativar autoaprovação'}</ActionButton>{profile.status !== 'archived' && <ActionButton disabled={saving} onClick={() => onUpdate(profile, 'archived', false, moderationNote)} tone="neutral">Arquivar</ActionButton>}{saving && <span className="inline-flex items-center gap-2 px-2 py-2 text-sm font-semibold text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/> Salvando</span>}</div></div></div></article>
}

function MembersPanel({ members, query, loading, onQuery, onReload, onSave }: { members: AdminMember[]; query: string; loading: boolean; onQuery: (value: string) => void; onReload: (query: string) => Promise<void>; onSave: (member: AdminMember, values: { displayName: string; marketingOptIn: boolean }) => Promise<void> }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-base font-extrabold">Contas cadastradas</p><p className="mt-1 text-sm text-slate-500">Acompanhe proprietários, quantidade de perfis e preferências de comunicação.</p></div><div className="flex gap-2"><input value={query} onChange={event => onQuery(event.target.value)} placeholder="E-mail ou nome" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-fuchsia-400 sm:w-56"/><button type="button" onClick={() => void onReload(query)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">Buscar</button></div></div><div className="mt-6 grid gap-3">{members.length === 0 ? <EmptyState icon={Users} title="Nenhuma conta encontrada" text="Tente outro nome ou e-mail."/> : members.map(member => <MemberRow key={member.id} member={member} loading={loading} onSave={onSave}/>)}</div></section>
}

function MemberRow({ member, loading, onSave }: { member: AdminMember; loading: boolean; onSave: (member: AdminMember, values: { displayName: string; marketingOptIn: boolean }) => Promise<void> }) {
  const [name, setName] = useState(member.display_name)
  const [marketing, setMarketing] = useState(member.marketing_opt_in)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const save = async () => { setSaving(true); try { await onSave(member, { displayName: name, marketingOptIn: marketing }); setEditing(false) } finally { setSaving(false) } }
  return <article className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fuchsia-100 text-sm font-black text-fuchsia-700">{(member.display_name || member.email).slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1">{editing ? <input value={name} onChange={event => setName(event.target.value)} className="w-full max-w-xs rounded-lg border border-slate-200 px-2 py-1 text-sm font-bold"/> : <p className="text-sm font-extrabold">{member.display_name || 'Sem nome de exibição'}</p>}<p className="truncate text-xs text-slate-500">{member.email}</p></div><div className="grid grid-cols-2 gap-2 text-center text-xs sm:flex sm:text-left"><span className="rounded-lg bg-slate-100 px-3 py-2"><strong className="block text-sm">{member.profile_count}</strong>perfis</span><span className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800"><strong className="block text-sm">{member.active_profile_count}</strong>ativos</span></div><div className="flex items-center gap-2">{editing && <label className="flex items-center gap-1 text-xs font-semibold text-slate-600"><input type="checkbox" checked={marketing} onChange={event => setMarketing(event.target.checked)} className="accent-fuchsia-600"/> Marketing</label>}<button type="button" disabled={saving || loading} onClick={() => editing ? void save() : setEditing(true)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">{saving ? 'Salvando...' : editing ? 'Salvar' : 'Editar conta'}</button></div></div></article>
}

function ActivityPanel({ logs, loading, onRefresh }: { logs: AuditLog[]; loading: boolean; onRefresh: () => void }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-base font-extrabold">Trilha de auditoria</p><p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">Decisões administrativas e alterações de segurança registradas pelo sistema.</p></div><button type="button" onClick={onRefresh} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Atualizar</button></div>{logs.length === 0 ? <EmptyState icon={Activity} title="Sem eventos registrados" text="As decisões feitas no painel aparecerão nesta trilha." /> : <ol className="mt-7 space-y-0">{logs.map((log, index) => <li key={`${log.created_at}-${index}`} className="relative flex gap-4 pb-6 last:pb-0"><span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fuchsia-50 text-fuchsia-700"><Activity className="h-4 w-4"/></span>{index < logs.length - 1 && <span className="absolute left-[17px] top-9 h-[calc(100%-20px)] w-px bg-slate-200"/>}<div className="pt-1"><p className="text-sm font-bold text-slate-800">{formatAuditLog(log)}</p><p className="mt-1 text-xs text-slate-400">{formatDate(log.created_at)}</p></div></li>)}</ol>}</section> }

function SecurityPanel({ currentPassword, newPassword, message, loading, onCurrent, onNew, onSubmit }: { currentPassword: string; newPassword: string; message: string; loading: boolean; onCurrent: (value: string) => void; onNew: (value: string) => void; onSubmit: (event: React.FormEvent) => Promise<void> }) { return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"><form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><LockKeyhole className="h-5 w-5"/></span><div><h2 className="font-extrabold">Alterar senha administrativa</h2><p className="mt-1 text-sm text-slate-500">Use uma senha exclusiva, longa e não reutilizada.</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">Senha atual<input type="password" autoComplete="current-password" value={currentPassword} onChange={event => onCurrent(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-100" required/></label><label className="text-sm font-bold text-slate-700">Nova senha<input type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={event => onNew(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-100" required/></label></div>{message && <p className={`mt-4 text-sm font-medium ${message.includes('sucesso') ? 'text-emerald-700' : 'text-rose-700'}`}>{message}</p>}<button disabled={loading} type="submit" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"><LockKeyhole className="h-4 w-4"/> Atualizar senha</button></form><aside className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/60 p-5"><ShieldCheck className="h-6 w-6 text-fuchsia-700"/><h2 className="mt-4 font-extrabold text-slate-900">Boas práticas</h2><ul className="mt-3 space-y-3 text-sm leading-5 text-slate-600"><li>Não compartilhe o acesso administrativo.</li><li>Registre sempre o motivo de uma recusa.</li><li>Revise fotos e dados antes de publicar.</li><li>Encerre a sessão em computadores compartilhados.</li></ul></aside></div> }

function AdminLogin({ email, password, passwordVisible, loading, error, onEmail, onPassword, onVisible, onSubmit }: { email: string; password: string; passwordVisible: boolean; loading: boolean; error: string; onEmail: (value: string) => void; onPassword: (value: string) => void; onVisible: () => void; onSubmit: (event: React.FormEvent) => Promise<void> }) { return <main className="flex min-h-dvh items-center justify-center bg-[#121018] px-4 py-10"><section className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-black/30 md:grid-cols-[.9fr_1.1fr]"><aside className="bg-gradient-to-br from-[#26132b] via-[#6d1657] to-[#d11d73] p-8 text-white sm:p-10"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><ShieldCheck className="h-6 w-6"/></span><p className="mt-10 text-xs font-bold uppercase tracking-[.2em] text-fuchsia-100">TheSex · acesso restrito</p><h1 className="mt-3 text-3xl font-extrabold tracking-tight">Central de operação e confiança.</h1><p className="mt-4 text-sm leading-6 text-fuchsia-100">Revise perfis, mantenha a vitrine segura e acompanhe cada decisão da moderação.</p></aside><div className="p-7 sm:p-10"><Link to="/" className="text-sm font-bold text-slate-500 transition hover:text-fuchsia-700">← Voltar ao site</Link><h2 className="mt-9 text-2xl font-extrabold tracking-tight">Entrar no painel</h2><p className="mt-2 text-sm text-slate-500">Use suas credenciais administrativas.</p><form className="mt-7 space-y-4" onSubmit={onSubmit}><label className="block text-sm font-bold text-slate-700">E-mail<input type="email" autoComplete="email" value={email} onChange={event => onEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none transition focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-100" required/></label><label className="block text-sm font-bold text-slate-700">Senha<span className="relative mt-1.5 block"><input type={passwordVisible ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => onPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-11 font-normal outline-none transition focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-100" required/><button type="button" onClick={onVisible} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-800" aria-label={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'}>{passwordVisible ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button></span></label>{error && <ErrorNotice message={error}/>}<button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <LockKeyhole className="h-4 w-4"/>} Entrar com segurança</button></form></div></section></main> }

function ActionButton({ children, disabled, onClick, tone }: { children: ReactNode; disabled: boolean; onClick: () => void; tone: 'positive' | 'danger' | 'highlight' | 'neutral' }) { const classes = { positive: 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600', danger: 'border-rose-200 text-rose-700 hover:bg-rose-50', highlight: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100', neutral: 'border-slate-200 text-slate-700 hover:bg-slate-50' }; return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${classes[tone]}`}>{children}</button> }
function EmptyState({ icon: Icon, title, text, compact = false }: { icon: typeof ShieldCheck; title: string; text: string; compact?: boolean }) { return <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-10' : 'mt-5 rounded-2xl border border-dashed border-slate-200 py-14'}`}><span className="rounded-2xl bg-slate-100 p-3 text-slate-400"><Icon className="h-6 w-6"/></span><h3 className="mt-3 text-sm font-extrabold">{title}</h3><p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{text}</p></div> }
function ErrorNotice({ message }: { message: string }) { return <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0"/>{message}</div> }
function formatDate(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value.replace(' ', 'T') + 'Z')) }
function formatAuditLog(log: AuditLog) { if (log.action === 'profile_moderated') return `${log.admin_email} definiu um perfil como ${String(log.details.status ?? 'atualizado')}.`; if (log.action === 'password_changed') return `${log.admin_email} alterou a senha administrativa.`; return `${log.admin_email} executou ${log.action}.` }
function LoadingScreen({ compact = false }: { compact?: boolean }) { return <div className={`flex items-center justify-center ${compact ? 'min-h-52' : 'min-h-dvh bg-[#f5f5f7]'}`}><Loader2 className="h-7 w-7 animate-spin text-fuchsia-700"/><span className="ml-3 text-sm font-medium text-slate-500">Carregando central administrativa…</span></div> }
// --- The Sex Only Admin Components ---

function TsoDashboard() {
  const [data, setData] = useState({ creators: 0, posts: 0, sales: 0, revenue: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    clubApi.adminOverview().then((overview) => {
      setData({ creators: overview.creators, posts: overview.posts, sales: overview.paid_orders, revenue: overview.revenue_cents / 100 })
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-fuchsia-900 to-rose-900 p-8 text-white shadow-xl">
        <h2 className="text-2xl font-extrabold tracking-tight">TheSex Club</h2>
        <p className="mt-2 text-fuchsia-200">Canais, publicações e receita da área de conteúdo exclusivo.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {label: 'Creators Ativos', val: loading ? '...' : data.creators}, 
          {label: 'Posts PPV', val: loading ? '...' : data.posts}, 
          {label: 'Vendas (Total)', val: loading ? '...' : data.sales}, 
          {label: 'Receita (Total)', val: loading ? '...' : `R$ ${data.revenue.toFixed(2).replace('.', ',')}`}
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{s.label}</p>
            <p className="mt-2 text-3xl font-black">{s.val}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function TsoCreators() {
  const [creators, setCreators] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    clubApi.adminCreators().then(setCreators).finally(() => setLoading(false))
  }, [])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-extrabold mb-4">Gerenciamento de Creators</h2>
      {loading ? <LoadingScreen compact /> : creators.length === 0 ? <EmptyState icon={Users} title="Nenhum creator" text="Nenhum registro encontrado via API." /> : (
        <div className="divide-y divide-slate-100">
          {creators.map((c) => (
            <div key={c.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="font-bold">{c.username}</p>
                <p className="text-xs text-slate-500">{c.bio || 'Sem bio'}</p>
              </div>
              <span className={`text-xs font-bold uppercase ${c.status === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>{c.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TsoPosts() {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    clubApi.adminPosts().then(setPosts).finally(() => setLoading(false))
  }, [])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-extrabold mb-4">Gerenciamento de Posts (PPV)</h2>
      {loading ? <LoadingScreen compact /> : posts.length === 0 ? <EmptyState icon={ImageIcon} title="Nenhum post" text="Nenhum registro encontrado via API." /> : (
        <div className="divide-y divide-slate-100">
          {posts.map((p) => (
            <div key={p.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="font-bold">{p.title}</p>
                <p className="text-xs text-slate-500">{p.visibility === 'paid' ? `Pago (R$ ${(p.priceCents / 100).toFixed(2)})` : 'Público'}</p>
              </div>
              <span className="text-xs text-slate-400">{p.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TsoTracking() {
  const [links, setLinks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.resolve([]).then(setLinks).finally(() => setLoading(false))
  }, [])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-extrabold mb-4">Monitoramento de Links (Tracking)</h2>
      {loading ? <LoadingScreen compact /> : links.length === 0 ? <EmptyState icon={MapPin} title="Sem métricas" text="Nenhum registro encontrado via API." /> : (
        <div className="divide-y divide-slate-100">
          {links.map((l) => (
            <div key={l.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="font-bold">{l.name}</p>
                <p className="text-xs text-fuchsia-600">thesex.online/l/{l.code}</p>
              </div>
              <span className="text-xs text-slate-400">Tipo: {l.destinationType}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TsoOrders() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    clubApi.adminOrders().then(setOrders).finally(() => setLoading(false))
  }, [])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-extrabold mb-4">Vendas e Transações</h2>
      {loading ? <LoadingScreen compact /> : orders.length === 0 ? <EmptyState icon={BadgeCheck} title="Nenhuma ordem" text="Nenhum registro encontrado via API." /> : (
        <div className="divide-y divide-slate-100">
          {orders.map((o) => (
            <div key={o.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="font-bold">Pedido: {o.id.slice(0, 8)}</p>
                <p className="text-xs text-slate-500">Valor: R$ {(o.amount_cents / 100).toFixed(2)}</p>
              </div>
              <span className={`text-xs font-bold uppercase ${o.status === 'paid' ? 'text-emerald-600' : 'text-slate-400'}`}>{o.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
