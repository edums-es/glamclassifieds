import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { profilesApi } from '@/lib/api'
import { ArrowLeft, Upload, Plus, X, Image, Loader2, CheckCircle } from 'lucide-react'
import { Link } from '@tanstack/react-router'

const TAG_OPTIONS = ['VIP', 'Travel', 'Dinner Dates', 'Fashion', 'Multilingual', 'Fitness', 'Beach', 'Yacht', 'Nightlife', 'Cultural', 'Arts', 'Luxury', 'Events', 'Shopping', 'Dining', 'Wellness', 'Dance', 'Music', 'Trendy', 'Adventure']

export const Route = createFileRoute('/create')({
  head: () => ({
    meta: [
      { title: 'Anunciar perfil · TheSex' },
      { name: 'description', content: 'Envie seu perfil para análise e publicação.' },
    ],
  }),
  component: CreateProfilePage,
})

function CreateProfilePage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [city, setCity] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newPhotos = Array.from(files).map(f => ({
      file: f,
      preview: URL.createObjectURL(f),
    }))
    setPhotos(prev => [...prev, ...newPhotos].slice(0, 5))
  }

  const removePhoto = (i: number) => {
    URL.revokeObjectURL(photos[i].preview)
    setPhotos(prev => prev.filter((_, idx) => idx !== i))
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim() || !age || !city.trim() || !price.trim()) {
      setError('Preencha todos os campos obrigatórios.')
      return
    }
    setSubmitting(true)
    try {
      await profilesApi.submit({
        name,
        age,
        city,
        price,
        description,
        tags: selectedTags,
        photos: photos.map(photo => photo.file),
      })

      setSubmitted(true)
      setTimeout(() => navigate({ to: '/' }), 2000)
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar o perfil. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao diretório
        </Link>

        <h1 className="font-serif text-2xl font-bold text-foreground">Anunciar perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">Envie seus dados. Todo perfil passa por análise antes da publicação.</p>

        {submitted ? (
          <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
            <CheckCircle className="h-12 w-12 text-accent" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">Perfil enviado!</h2>
            <p className="mt-1 text-sm text-muted-foreground">Vamos analisar os dados antes de publicar.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {/* Photos */}
            <div>
              <label className="text-sm font-semibold text-foreground">Fotos <span className="text-muted-foreground font-normal">(até 5)</span></label>
              <div className="mt-2 flex flex-wrap gap-3">
                {photos.map((p, i) => (
                  <div key={i} className="relative h-28 w-28 overflow-hidden rounded-xl border border-border">
                    <img src={p.preview} alt={`Preview ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {photos.length < 5 && (
                  <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
                    <Upload className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Adicionar</span>
                    <input type="file" accept="image/*" onChange={handlePhotos} className="hidden" multiple />
                  </label>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">A primeira foto será usada como imagem principal.</p>
            </div>

            {/* Name + Age */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-foreground">Nome *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nome de exibição"
                  className="mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground">Idade *</label>
                <input
                  type="number"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  placeholder="Sua idade"
                  min={18}
                  max={99}
                  className="mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  required
                />
              </div>
            </div>

            {/* City + Price */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-foreground">Cidade *</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="Ex.: São Paulo, Rio de Janeiro"
                  className="mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground">Valor *</label>
                <input
                  type="text"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="e.g. €500/hr"
                  className="mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  required
                />
              </div>
            </div>

            {/* Tags */}
            <div>
                <label className="text-sm font-semibold text-foreground">Interesses</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {TAG_OPTIONS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      selectedTags.includes(tag)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-semibold text-foreground">Sobre você</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Conte um pouco sobre você, seus interesses e disponibilidade..."
                rows={4}
                className="mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando perfil...
                </>
              ) : (
                'Enviar para análise'
              )}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
