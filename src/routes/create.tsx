import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { profilesApi } from '@/lib/api'
import { ArrowLeft, BadgeCheck, CheckCircle2, ImagePlus, Loader2, LockKeyhole, Phone, ShieldCheck, X } from 'lucide-react'

const CATEGORY_OPTIONS = ['Acompanhante', 'Massagem', 'Trans e Travesti', 'Encontro casual']
const TAG_OPTIONS = ['VIP', 'Viagens', 'Jantares', 'Eventos', 'Bilíngue', 'Fitness', 'Bem-estar', 'Lifestyle']
const SERVICE_OPTIONS = ['Atendimento personalizado', 'Companhia para eventos', 'Jantares', 'Massagem', 'Viagens', 'Conteúdo online']
const SERVICE_FOR_OPTIONS = ['Homens', 'Mulheres', 'Casais', 'Pessoas trans']
const MEETING_PLACE_OPTIONS = ['Local próprio', 'Hotel ou motel', 'Domicílio', 'Eventos']
const PAYMENT_OPTIONS = ['Pix', 'Dinheiro', 'Cartão', 'Transferência']

export const Route = createFileRoute('/create')({
  head: () => ({ meta: [{ title: 'Cadastrar perfil · TheSex' }, { name: 'description', content: 'Envie um perfil para análise privada.' }] }),
  component: CreateProfilePage,
})

function CreateProfilePage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0])
  const [city, setCity] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [price, setPrice] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [availability, setAvailability] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [services, setServices] = useState<string[]>([])
  const [serviceFor, setServiceFor] = useState<string[]>([])
  const [meetingPlaces, setMeetingPlaces] = useState<string[]>([])
  const [paymentMethods, setPaymentMethods] = useState<string[]>([])
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([])
  const [adultConfirmed, setAdultConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handlePhotos = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    const next = files.map(file => ({ file, preview: URL.createObjectURL(file) }))
    setPhotos(current => [...current, ...next].slice(0, 5))
  }

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photos[index].preview)
    setPhotos(current => current.filter((_, photoIndex) => photoIndex !== index))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (!name.trim() || !age || !city.trim() || !price.trim() || !contactPhone.trim() || photos.length === 0 || !adultConfirmed) {
      setError('Preencha os campos obrigatórios, envie ao menos uma foto e confirme a maioridade.')
      return
    }
    setSubmitting(true)
    try {
      await profilesApi.submit({ name, age, category, city, neighborhood, price, contactPhone, availability, services, serviceFor, meetingPlaces, paymentMethods, description, tags: selectedTags, photos: photos.map(photo => photo.file), adultConfirmed })
      setSubmitted(true)
      setTimeout(() => navigate({ to: '/' }), 2500)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível enviar o perfil.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return <main className="min-h-dvh bg-[#fff8fb] px-4 py-16"><section className="mx-auto max-w-lg rounded-3xl bg-white p-10 text-center shadow-xl shadow-pink-950/10"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" /><h1 className="mt-5 text-2xl font-bold text-slate-900">Cadastro enviado</h1><p className="mt-3 text-sm leading-6 text-slate-500">Seu perfil entrou na fila de revisão. Você será redirecionada para a vitrine.</p></section></main>
  }

  return (
    <main className="min-h-dvh bg-[#fff8fb] pb-16">
      <header className="border-b border-pink-100 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6"><Link to="/" className="text-xl font-black tracking-tight text-pink-600">the<span className="text-slate-900">sex</span></Link><Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-pink-600"><ArrowLeft className="h-4 w-4" /> Voltar à vitrine</Link></div></header>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:py-14">
        <aside className="rounded-3xl bg-gradient-to-br from-pink-600 via-fuchsia-600 to-violet-700 p-7 text-white shadow-xl shadow-pink-700/20 sm:p-9">
          <BadgeCheck className="h-9 w-9" /><p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-pink-100">Cadastro de perfis</p><h1 className="mt-3 text-3xl font-black leading-tight">Seu perfil, sua vitrine, no seu ritmo.</h1><p className="mt-5 text-sm leading-6 text-pink-50">Envie informações e fotos. A publicação acontece somente após a análise do painel administrativo.</p>
          <div className="mt-8 space-y-4 text-sm"><p className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0" /> Revisão antes de qualquer publicação</p><p className="flex gap-3"><LockKeyhole className="h-5 w-5 shrink-0" /> Dados enviados em área protegida</p><p className="flex gap-3"><Phone className="h-5 w-5 shrink-0" /> Contato exibido apenas no perfil aprovado</p></div>
        </aside>
        <form onSubmit={submit} className="model-form rounded-3xl border border-pink-100 bg-white p-6 shadow-sm sm:p-9">
          <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-pink-600">Publicação em 3 etapas</p><h2 className="mt-2 text-2xl font-black text-slate-900">Cadastre seu perfil</h2><p className="mt-2 text-sm text-slate-500">1. Informações e fotos · 2. Detalhes do atendimento · 3. Revisão administrativa.</p></div>
          <div className="mt-8"><Label title="Fotos do perfil *" hint="De 1 a 5 fotos, JPG, PNG ou WEBP (até 5 MB cada)." /><div className="mt-3 flex flex-wrap gap-3">{photos.map((photo, index) => <div key={photo.preview} className="relative h-28 w-24 overflow-hidden rounded-2xl bg-slate-100"><img src={photo.preview} alt={`Prévia ${index + 1}`} className="h-full w-full object-cover"/><button type="button" onClick={() => removePhoto(index)} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"><X className="h-3 w-3" /></button></div>)}{photos.length < 5 && <label className="flex h-28 w-24 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-pink-200 bg-pink-50 text-center text-pink-600 hover:bg-pink-100"><ImagePlus className="h-5 w-5"/><span className="mt-2 text-[11px] font-bold">Adicionar</span><input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handlePhotos}/></label>}</div></div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2"><Field label="Nome de exibição *"><input value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Sofia" required /></Field><Field label="Idade *"><input value={age} onChange={event => setAge(event.target.value)} type="number" min="18" max="99" placeholder="18+" required /></Field><Field label="Categoria *"><select value={category} onChange={event => setCategory(event.target.value)}>{CATEGORY_OPTIONS.map(item => <option key={item}>{item}</option>)}</select></Field><Field label="Cidade *"><input value={city} onChange={event => setCity(event.target.value)} placeholder="Ex.: São Paulo" required /></Field><Field label="Bairro ou região"><input value={neighborhood} onChange={event => setNeighborhood(event.target.value)} placeholder="Ex.: Jardins" /></Field><Field label="Valor *"><input value={price} onChange={event => setPrice(event.target.value)} placeholder="Ex.: R$ 500 / hora" required /></Field><Field label="WhatsApp para contato *"><input value={contactPhone} onChange={event => setContactPhone(event.target.value)} inputMode="tel" placeholder="DDD + número" required /></Field><Field label="Disponibilidade"><input value={availability} onChange={event => setAvailability(event.target.value)} placeholder="Ex.: Hoje até 22h" /></Field></div>
          <div className="mt-7 grid gap-6 border-t border-pink-100 pt-7 sm:grid-cols-2"><SelectionGroup title="Serviços" options={SERVICE_OPTIONS} selected={services} onChange={setServices}/><SelectionGroup title="Atendo" options={SERVICE_FOR_OPTIONS} selected={serviceFor} onChange={setServiceFor}/><SelectionGroup title="Local de atendimento" options={MEETING_PLACE_OPTIONS} selected={meetingPlaces} onChange={setMeetingPlaces}/><SelectionGroup title="Formas de pagamento" options={PAYMENT_OPTIONS} selected={paymentMethods} onChange={setPaymentMethods}/></div>
          <div className="mt-6"><Label title="Seus diferenciais" hint="Selecione apenas o que representa seu perfil."/><div className="mt-3 flex flex-wrap gap-2">{TAG_OPTIONS.map(tag => <button key={tag} type="button" onClick={() => setSelectedTags(current => current.includes(tag) ? current.filter(value => value !== tag) : [...current, tag])} className={`rounded-full border px-3 py-2 text-xs font-bold transition ${selectedTags.includes(tag) ? 'border-pink-600 bg-pink-600 text-white' : 'border-pink-100 bg-white text-slate-500 hover:border-pink-300'}`}>{tag}</button>)}</div></div>
          <div className="mt-6"><Label title="Sobre você" hint="Uma apresentação curta e clara melhora a revisão."/><textarea value={description} onChange={event => setDescription(event.target.value)} rows={4} placeholder="Conte um pouco sobre seu estilo, atendimento e disponibilidade..." /></div>
          <label className="mt-6 flex cursor-pointer gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-5 text-slate-600"><input className="mt-1 h-4 w-4 accent-pink-600" type="checkbox" checked={adultConfirmed} onChange={event => setAdultConfirmed(event.target.checked)} /><span>Confirmo que tenho 18 anos ou mais e que possuo autorização para usar as fotos e informações enviadas.</span></label>
          {error && <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>}
          <button disabled={submitting} className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-pink-600/20 transition hover:bg-pink-700 disabled:opacity-60">{submitting && <Loader2 className="h-4 w-4 animate-spin"/>}{submitting ? 'Enviando perfil...' : 'Enviar para análise'}</button>
        </form>
      </section>
    </main>
  )
}

function Label({ title, hint }: { title: string; hint?: string }) { return <label className="block text-sm font-bold text-slate-800">{title}{hint && <span className="mt-1 block text-xs font-normal text-slate-400">{hint}</span>}</label> }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-sm font-bold text-slate-800">{label}<span className="mt-1.5 block">{children}</span></label> }
function SelectionGroup({ title, options, selected, onChange }: { title: string; options: string[]; selected: string[]; onChange: (values: string[]) => void }) { return <div><Label title={title} hint="Selecione as opções que deseja exibir."/><div className="mt-3 flex flex-wrap gap-2">{options.map(option => <button key={option} type="button" onClick={() => onChange(selected.includes(option) ? selected.filter(value => value !== option) : [...selected, option])} className={`rounded-full border px-3 py-2 text-xs font-bold transition ${selected.includes(option) ? 'border-pink-600 bg-pink-600 text-white' : 'border-pink-100 bg-white text-slate-500 hover:border-pink-300'}`}>{option}</button>)}</div></div> }
