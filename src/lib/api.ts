export type Profile = {
  id: string
  name: string
  age: number
  category: string
  city: string
  neighborhood: string
  price: string
  contact_phone: string
  availability: string
  photos: string[]
  description: string
  tags: string[]
  is_featured: boolean
}

export type Admin = {
  id: number
  email: string
}

export type ProfileStatus = 'pending' | 'active' | 'rejected' | 'archived'

export type ModerationProfile = Profile & {
  status: ProfileStatus
  created_at: string
  updated_at: string
}

export type AuditLog = {
  action: string
  profile_id: string | null
  details: Record<string, unknown>
  created_at: string
  admin_email: string
}

type ApiEnvelope<T> = { data: T }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    credentials: 'same-origin',
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
    category: string
    city: string
    neighborhood: string
    price: string
    contactPhone: string
    availability: string
    description: string
    tags: string[]
    photos: File[]
    adultConfirmed: boolean
  }): Promise<void> {
    const body = new FormData()
    body.set('name', values.name)
    body.set('age', values.age)
    body.set('category', values.category)
    body.set('city', values.city)
    body.set('neighborhood', values.neighborhood)
    body.set('price', values.price)
    body.set('contact_phone', values.contactPhone)
    body.set('availability', values.availability)
    body.set('description', values.description)
    body.set('tags', JSON.stringify(values.tags))
    body.set('adult_confirmed', String(values.adultConfirmed))
    values.photos.forEach(photo => body.append('photos[]', photo))

    await request('/profiles', { method: 'POST', body })
  },
}

export const adminApi = {
  async login(email: string, password: string): Promise<Admin> {
    const payload = await request<ApiEnvelope<Admin>>('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    return payload.data
  },

  async logout(): Promise<void> {
    await request('/admin/logout', { method: 'POST' })
  },

  async me(): Promise<Admin> {
    const payload = await request<ApiEnvelope<Admin>>('/admin/me')
    return payload.data
  },

  async listProfiles(status: ProfileStatus): Promise<ModerationProfile[]> {
    const payload = await request<ApiEnvelope<ModerationProfile[]>>(`/admin/profiles?status=${status}`)
    return payload.data
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await request('/admin/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    })
  },

  async audit(): Promise<AuditLog[]> {
    const payload = await request<ApiEnvelope<AuditLog[]>>('/admin/audit')
    return payload.data
  },

  async updateProfile(id: string, changes: { status: ProfileStatus; is_featured: boolean }): Promise<ModerationProfile> {
    const payload = await request<ApiEnvelope<ModerationProfile>>(`/admin/profiles/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    })
    return payload.data
  },
}
