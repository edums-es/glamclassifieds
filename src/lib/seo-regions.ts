export const SITE_URL = 'https://thesex.online'

export type SeoRegion = {
  slug: string
  city: string
  state: string
  title: string
  description: string
  intro: string
}

export const SEO_REGIONS: SeoRegion[] = [
  { slug: 'sao-paulo', city: 'Sao Paulo', state: 'SP', title: 'Perfis em São Paulo', description: 'Encontre perfis publicados em São Paulo. Consulte fotos, região, disponibilidade e formas de contato no TheSex.', intro: 'Explore perfis publicados em São Paulo e encontre opções por região, categoria e disponibilidade.' },
  { slug: 'rio-de-janeiro', city: 'Rio de Janeiro', state: 'RJ', title: 'Perfis no Rio de Janeiro', description: 'Encontre perfis publicados no Rio de Janeiro. Consulte fotos, região, disponibilidade e formas de contato no TheSex.', intro: 'Veja perfis disponíveis no Rio de Janeiro, organizados por região e categoria para facilitar sua busca.' },
  { slug: 'belo-horizonte', city: 'Belo Horizonte', state: 'MG', title: 'Perfis em Belo Horizonte', description: 'Encontre perfis publicados em Belo Horizonte com informações claras e contato direto.', intro: 'Uma seleção de perfis em Belo Horizonte para quem busca descobrir opções pela cidade.' },
  { slug: 'brasilia', city: 'Brasilia', state: 'DF', title: 'Perfis em Brasília', description: 'Encontre perfis publicados em Brasília. Navegue por categoria, região e disponibilidade.', intro: 'Descubra perfis publicados em Brasília, com informações organizadas para uma busca objetiva.' },
  { slug: 'curitiba', city: 'Curitiba', state: 'PR', title: 'Perfis em Curitiba', description: 'Encontre perfis publicados em Curitiba. Consulte região, categoria e formas de contato.', intro: 'Encontre perfis em Curitiba e filtre sua busca pelas informações mais importantes para você.' },
  { slug: 'salvador', city: 'Salvador', state: 'BA', title: 'Perfis em Salvador', description: 'Encontre perfis publicados em Salvador com fotos, região e disponibilidade.', intro: 'Explore os perfis publicados em Salvador e encontre opções por categoria e região.' },
  { slug: 'porto-alegre', city: 'Porto Alegre', state: 'RS', title: 'Perfis em Porto Alegre', description: 'Encontre perfis publicados em Porto Alegre. Consulte detalhes e formas de contato.', intro: 'Perfis em Porto Alegre reunidos em uma página local, clara e fácil de navegar.' },
  { slug: 'recife', city: 'Recife', state: 'PE', title: 'Perfis em Recife', description: 'Encontre perfis publicados em Recife. Consulte fotos, região e disponibilidade.', intro: 'Veja os perfis publicados em Recife e navegue por categoria para encontrar o que procura.' },
  { slug: 'fortaleza', city: 'Fortaleza', state: 'CE', title: 'Perfis em Fortaleza', description: 'Encontre perfis publicados em Fortaleza. Consulte região, disponibilidade e contato.', intro: 'Explore perfis em Fortaleza organizados para deixar sua pesquisa mais simples.' },
  { slug: 'goiania', city: 'Goiania', state: 'GO', title: 'Perfis em Goiânia', description: 'Encontre perfis publicados em Goiânia. Consulte categoria, região e disponibilidade.', intro: 'Uma página local para descobrir perfis em Goiânia, com detalhes antes do contato.' },
]

export function getSeoRegion(slug: string): SeoRegion | undefined {
  return SEO_REGIONS.find((region) => region.slug === slug)
}
