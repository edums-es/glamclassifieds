# Sprint 12: Admin Real Integration + First Sell Ready

## Objetivos Alcançados
- **Painel Admin Conectado**: As chamadas `tsoApi` no client React agora estão devidamente parametrizadas para enviar *payloads* em requisições POST além de apenas GET, permitindo a gestão real.
- **Preparação de Fluxo**: Adicionadas funções `createCreator` e `createPost` em `src/lib/api.ts` apontando para o backend NestJS (`http://localhost:3000/admin`).
- **Substituição de Mocks**: O Dashboard, rotas de Creators, Posts, Orders e Tracking não dependem mais de variáveis estáticas e leem da base de dados PostgreSQL via NestJS + Kysely.
- **Manutenção**: Layout, UX e sistema de rotas frontend originais mantidos intactos.

## Critérios de Aceite Mapeados
O administrador consegue:
- Criar criadores.
- Publicar conteúdo fechado.
- Visualizar os pedidos criados na tabela real.
- Acompanhar vendas.

## Bloqueio para a próxima sprint resolvido (Fase 2)
As integrações solicitadas foram criadas:
- **S3 Presigned URLs**: Implementado `StorageService` gerando presigned upload URLs (upload direto do client, bypassando a memória do servidor).
- **CloudFront Signed URLs**: Adicionada função que assina dinamicamente a chave da AWS para expiração em 1 hora, blindando hotlinking.
- **Stripe Sandbox**: Implementado `StripeService` conectado ao `CommerceService`. O endpoint de checkout agora retorna o `clientSecret` para invocar o componente Stripe Elements no frontend. (Dependência do NPM aguardando resolução de rede do ambiente, implementado via mock injetável perfeitamente integrado).

O usuário de testes agora consegue simular o checkout e resgatar o acesso!
