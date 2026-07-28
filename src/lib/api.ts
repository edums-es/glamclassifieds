export type Profile = {
  id: string
  name: string
  age: number
  city: string
  price: string
  photos: string[]
  description: string
  tags: string[]
  is_featured: boolean
}

type ApiEnvelope<T> = { data: T }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || 'Não foi possível concluir a solicitação.')
  }

  return payload as T
}

export const profilesApi = {
  async list(): Promise<Profile[]> {
    const payload = await request<ApiEnvelope<Profile[]>>('/profiles')
    return payload.data
  },

  async get(id: string): Promise<Profile> {
    const payload = await request<ApiEnvelope<Profile>>(`/profiles/${encodeURIComponent(id)}`)
    return payload.data
  },

  async submit(values: {
    name: string
    age: string
    city: string
    price: string
    description: string
    tags: string[]
    photos: File[]
  }): Promise<void> {
    const body = new FormData()
    body.set('name', values.name)
    body.set('age', values.age)
    body.set('city', values.city)
    body.set('price', values.price)
    body.set('description', values.description)
    body.set('tags', JSON.stringify(values.tags))
    values.photos.forEach(photo => body.append('photos[]', photo))

    await request('/profiles', { method: 'POST', body })
  },
}
