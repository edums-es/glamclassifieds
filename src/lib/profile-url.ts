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
  return `${slugify(profile.name)}-${technicalSuffix}`
}

export const PUBLIC_CATEGORY_PATHS: Record<string, string> = {
    Acompanhante: 'acompanhantes',
    Massagem: 'massagens',
    'Trans e Travesti': 'trans-e-travestis',
    'Encontro casual': 'encontros-casuais',
}

export function publicCategorySlug(category: string): string {
  return PUBLIC_CATEGORY_PATHS[category] ?? 'perfis'
}

export function isPublicCategorySlug(value: string): boolean {
  return Object.values(PUBLIC_CATEGORY_PATHS).includes(value)
}

export function publicProfilePath(profile: Pick<Profile, 'id' | 'name' | 'city' | 'category'>): string {
  return `/${publicCategorySlug(profile.category)}/${slugify(profile.city)}/${publicProfileId(profile)}`
}
