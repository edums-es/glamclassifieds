export const SITE_URL = 'https://thesex.online'

export type SeoRegion = { slug: string; city: string; displayCity: string; state: string; title: string; description: string; intro: string }

const region = (slug: string, city: string, displayCity: string, state: string) => ({
  slug,
  city,
  displayCity,
  state,
  title: `Acompanhantes em ${displayCity} | Escorts e Garotas de Programa`,
  description: `Encontre acompanhantes, escorts, garotas de programa e encontros casuais em ${displayCity}. Veja perfis, fotos e formas de contato no TheSex.`,
  intro: `Encontre acompanhantes, escorts e encontros casuais em ${displayCity}. Navegue por categorias, regiões e perfis publicados.`,
})

export const SEO_REGIONS: SeoRegion[] = [
  region('sao-paulo', 'Sao Paulo', 'São Paulo', 'SP'),
  region('rio-de-janeiro', 'Rio de Janeiro', 'Rio de Janeiro', 'RJ'),
  region('belo-horizonte', 'Belo Horizonte', 'Belo Horizonte', 'MG'),
  region('brasilia', 'Brasilia', 'Brasília', 'DF'),
  region('curitiba', 'Curitiba', 'Curitiba', 'PR'),
  region('salvador', 'Salvador', 'Salvador', 'BA'),
  region('porto-alegre', 'Porto Alegre', 'Porto Alegre', 'RS'),
  region('recife', 'Recife', 'Recife', 'PE'),
  region('fortaleza', 'Fortaleza', 'Fortaleza', 'CE'),
  region('goiania', 'Goiania', 'Goiânia', 'GO'),
]

export function getSeoRegion(slug: string): SeoRegion | undefined {
  return SEO_REGIONS.find((item) => item.slug === slug)
}
