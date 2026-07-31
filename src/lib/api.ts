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
  services: string[]
  service_for: string[]
  meeting_places: string[]
  payment_methods: string[]
  photos: string[]
  description: string
  tags: string[]
  is_featured: boolean
}

export type Admin = {
  id: number
  email: string
}

export type Member = {
  id: number
  email: string
  display_name: string
  marketing_opt_in: boolean
}

export type MemberDashboard = {
  member: Member
  counts: Record<ProfileStatus, number>
}

export type ProfileStatus = 'pending' | 'active' | 'rejected' | 'archived'

export type ModerationProfile = Profile & {
  status: ProfileStatus
  moderation_note: string
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
  async list(filters: { q?: string; city?: string; category?: string } = {}): Promise<Profile[]> {
    const search = new URLSearchParams()
    if (filters.q) search.set('q', filters.q)
    if (filters.city) search.set('city', filters.city)
    if (filters.category) search.set('category', filters.category)
    const payload = await request<ApiEnvelope<Profile[]>>(`/profiles${search.size ? `?${search}` : ''}`)
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
    services: string[]
    serviceFor: string[]
    meetingPlaces: string[]
    paymentMethods: string[]
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
    body.set('services', JSON.stringify(values.services))
    body.set('service_for', JSON.stringify(values.serviceFor))
    body.set('meeting_places', JSON.stringify(values.meetingPlaces))
    body.set('payment_methods', JSON.stringify(values.paymentMethods))
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

  async updateProfile(id: string, changes: { status: ProfileStatus; is_featured: boolean; moderationNote?: string }): Promise<ModerationProfile> {
    const payload = await request<ApiEnvelope<ModerationProfile>>(`/admin/profiles/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: changes.status, is_featured: changes.is_featured, moderation_note: changes.moderationNote ?? '' }),
    })
    return payload.data
  },
}

export const memberApi = {
  async register(values: { email: string; password: string; displayName: string; marketingOptIn: boolean; adultConfirmed: boolean }): Promise<Member> {
    const payload = await request<ApiEnvelope<Member>>('/member/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: values.email, password: values.password, display_name: values.displayName, marketing_opt_in: values.marketingOptIn, adult_confirmed: values.adultConfirmed }) })
    return payload.data
  },
  async login(email: string, password: string): Promise<Member> {
    const payload = await request<ApiEnvelope<Member>>('/member/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    return payload.data
  },
  async logout(): Promise<void> { await request('/member/logout', { method: 'POST' }) },
  async me(): Promise<Member> { const payload = await request<ApiEnvelope<Member>>('/member/me'); return payload.data },
  async dashboard(): Promise<MemberDashboard> { const payload = await request<ApiEnvelope<MemberDashboard>>('/member/dashboard'); return payload.data },
  async profiles(): Promise<ModerationProfile[]> { const payload = await request<ApiEnvelope<ModerationProfile[]>>('/member/profiles'); return payload.data },
  async updateProfile(id: string, values: Pick<Profile, 'name' | 'age' | 'category' | 'city' | 'neighborhood' | 'price' | 'contact_phone' | 'availability' | 'description' | 'tags' | 'services' | 'service_for' | 'meeting_places' | 'payment_methods'>): Promise<ModerationProfile> {
    const payload = await request<ApiEnvelope<ModerationProfile>>(`/member/profiles/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
    return payload.data
  },
  async setProfileStatus(id: string, status: 'pending' | 'archived'): Promise<ModerationProfile> {
    const payload = await request<ApiEnvelope<ModerationProfile>>(`/member/profiles/${encodeURIComponent(id)}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    return payload.data
  },
  async updateSettings(values: { displayName: string; marketingOptIn: boolean }): Promise<Member> { const payload = await request<ApiEnvelope<Member>>('/member/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: values.displayName, marketing_opt_in: values.marketingOptIn }) }); return payload.data },
  async changePassword(currentPassword: string, newPassword: string): Promise<void> { await request('/member/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) }) },
}
