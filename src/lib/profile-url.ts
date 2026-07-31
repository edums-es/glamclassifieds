import type { Profile } from '@/lib/api'

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'perfil'
}

export function publicProfileId(profile: Pick<Profile, 'id' | 'name' | 'city'>): string {
  const technicalSuffix = profile.id.replace(/-/g, '').slice(-12)
  return `${slugify(profile.name)}-${slugify(profile.city)}-${technicalSuffix}`
}

export function publicProfilePath(profile: Pick<Profile, 'id' | 'name' | 'city'>): string {
  return `/profile/${publicProfileId(profile)}`
}
