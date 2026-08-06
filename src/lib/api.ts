import { publicProfilePath } from '@/lib/profile-url'

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
  member_id: number | null
  member_email: string
  auto_approved: boolean
}

export type AdminMetrics = { profiles: Record<ProfileStatus, number>; members: number; auto_approved: number; submitted_today: number; submitted_last_7_days: number; generated_at: string }
export type AdminMember = { id: number; email: string; display_name: string; marketing_opt_in: boolean; created_at: string; updated_at: string; profile_count: number; active_profile_count: number; last_profile_at: string | null }

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
    return payload.data.map((profile) => ({ ...profile, id: publicProfilePath(profile) }))
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
  }): Promise<{ message: string }> {
    const form = new FormData()
    form.set('name', values.name)
    form.set('age', values.age)
    form.set('category', values.category)
    form.set('city', values.city)
    form.set('neighborhood', values.neighborhood)
    form.set('price', values.price)
    form.set('contact_phone', values.contactPhone)
    form.set('availability', values.availability)
    form.set('description', values.description)
    form.set('tags', JSON.stringify(values.tags))
    form.set('services', JSON.stringify(values.services))
    form.set('service_for', JSON.stringify(values.serviceFor))
    form.set('meeting_places', JSON.stringify(values.meetingPlaces))
    form.set('payment_methods', JSON.stringify(values.paymentMethods))
    form.set('adult_confirmed', String(values.adultConfirmed))
    values.photos.forEach(photo => form.append('photos[]', photo))
    const payload = await request<{ message: string }>('/profiles', { method: 'POST', body: form })
    return payload
  },

  async uploadPhoto(profileId: string, file: File): Promise<{ url: string }> {
    const formData = new FormData()
    formData.append('photo', file)
    const payload = await request<ApiEnvelope<{ url: string }>>(`/profiles/${encodeURIComponent(profileId)}/photos`, {
      method: 'POST',
      body: formData,
    })
    return payload.data
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
  async metrics(): Promise<AdminMetrics> { const payload = await request<ApiEnvelope<AdminMetrics>>('/admin/metrics'); return payload.data },
  async members(query = ''): Promise<AdminMember[]> { const payload = await request<ApiEnvelope<AdminMember[]>>(`/admin/members${query ? `?q=${encodeURIComponent(query)}` : ''}`); return payload.data },
  async updateMember(id: number, values: { displayName: string; marketingOptIn: boolean }): Promise<void> { await request(`/admin/members/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: values.displayName, marketing_opt_in: values.marketingOptIn }) }) },

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

  async updateProfile(id: string, changes: { status: ProfileStatus; is_featured: boolean; autoApproved?: boolean; moderationNote?: string; profile?: Partial<Pick<Profile, 'name' | 'city' | 'neighborhood' | 'price' | 'contact_phone' | 'availability' | 'description'>> }): Promise<ModerationProfile> {
    const payload = await request<ApiEnvelope<ModerationProfile>>(`/admin/profiles/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: changes.status, is_featured: changes.is_featured, auto_approved: changes.autoApproved ?? false, moderation_note: changes.moderationNote ?? '', profile: changes.profile }),
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

export type ClubCreator = {
  id: string
  username: string
  display_name: string
  bio: string
  monthly_price_cents: number
  status: 'pending' | 'active' | 'paused' | 'rejected'
  profile_url: string | null
  cover_photo: string | null
  created_at: string
}

export type ClubPost = {
  id: string
  creator_id: string
  caption: string
  visibility: 'public' | 'subscribers' | 'ppv'
  price_cents: number
  media: string[]
  status: 'draft' | 'pending' | 'published' | 'archived'
  published_at: string | null
  created_at: string
  creator_username?: string | null
  creator_name?: string | null
}

export type ClubOverview = { creators: number; creator_queue: number; posts: number; post_queue: number; paid_orders: number; revenue_cents: number }
export type ClubOrder = { id: string; kind: 'subscription' | 'ppv' | 'tip'; amount_cents: number; currency: string; status: 'pending' | 'paid' | 'failed' | 'refunded'; created_at: string; creator_username: string; member_email: string }

// Club uses the same origin, session and admin boundary as the public platform.
// It deliberately does not expose a browser-side secret or a second localhost API.
export const clubApi = {
  async creators(): Promise<ClubCreator[]> { const payload = await request<ApiEnvelope<ClubCreator[]>>('/club/creators'); return payload.data },
  async creator(username: string): Promise<ClubCreator> { const payload = await request<ApiEnvelope<ClubCreator>>(`/club/creators/${encodeURIComponent(username)}`); return payload.data },
  async creatorPosts(username: string): Promise<ClubPost[]> { const payload = await request<ApiEnvelope<ClubPost[]>>(`/club/creators/${encodeURIComponent(username)}/posts`); return payload.data },
  async feed(): Promise<ClubPost[]> { const payload = await request<ApiEnvelope<ClubPost[]>>('/club/feed'); return payload.data },
  async track(eventType: 'creator_viewed' | 'post_opened' | 'subscribe_intent' | 'ppv_intent', creatorId = '', postId = ''): Promise<void> { await request('/club/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: eventType, creator_id: creatorId, post_id: postId }) }) },
  async dashboard(): Promise<{ channels: ClubCreator[]; post_count: number }> { const payload = await request<ApiEnvelope<{ channels: ClubCreator[]; post_count: number }>>('/member/club/dashboard'); return payload.data },
  async createCreator(values: { profileId: string; username: string; displayName: string; bio: string; monthlyPriceCents: number }): Promise<{ id: string; status: string }> { const payload = await request<ApiEnvelope<{ id: string; status: string }>>('/member/club/creators', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile_id: values.profileId, username: values.username, display_name: values.displayName, bio: values.bio, monthly_price_cents: values.monthlyPriceCents }) }); return payload.data },
  async createPost(values: { creatorId: string; caption: string; visibility: ClubPost['visibility']; priceCents: number; media: string[] }): Promise<{ id: string; status: string }> { const payload = await request<ApiEnvelope<{ id: string; status: string }>>('/member/club/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creator_id: values.creatorId, caption: values.caption, visibility: values.visibility, price_cents: values.priceCents, media: values.media }) }); return payload.data },
  async adminOverview(): Promise<ClubOverview> { const payload = await request<ApiEnvelope<ClubOverview>>('/admin/club/overview'); return payload.data },
  async adminCreators(): Promise<ClubCreator[]> { const payload = await request<ApiEnvelope<ClubCreator[]>>('/admin/club/creators'); return payload.data },
  async moderateCreator(id: string, status: ClubCreator['status']): Promise<void> { await request(`/admin/club/creators/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }) },
  async adminPosts(): Promise<ClubPost[]> { const payload = await request<ApiEnvelope<ClubPost[]>>('/admin/club/posts'); return payload.data },
  async moderatePost(id: string, status: ClubPost['status']): Promise<void> { await request(`/admin/club/posts/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }) },
  async adminOrders(): Promise<ClubOrder[]> { const payload = await request<ApiEnvelope<ClubOrder[]>>('/admin/club/orders'); return payload.data },
}
