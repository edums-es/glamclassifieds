# TheSex — MVP moderno

Marketplace de perfis com frontend React e API PHP 8/MySQL, preparado para hospedagem compartilhada da Hostinger.

## O que já funciona

- Catálogo público consumindo uma API própria.
- Busca e filtros no navegador.
- Página individual de perfil.
- Envio de perfil com fotos, validação de tipo/tamanho e limite por IP.
- Todo envio nasce com status `pending`; só perfis `active` aparecem publicamente.
- Build estático versionado em `dist/` para o deploy automático por Git.

## Configuração da Hostinger

1. Crie um banco MySQL e importe `database/schema.sql` pelo phpMyAdmin.
2. No Gerenciador de Arquivos, copie `api/.env.example` para `api/.env` e preencha os dados reais do banco. Esse arquivo não entra no Git.
3. Garanta que `api/uploads/` tenha permissão de escrita pelo PHP (normalmente 755 na Hostinger).
4. Faça o deploy pelo Git. A raiz do repositório é o diretório público: `.htaccess` entrega o React em `dist/` e preserva as rotas da API em `/api`.
5. Confirme `https://seu-dominio/api/v1/health`. A resposta esperada é `{ "status": "ok" }`.

## Desenvolvimento

```bash
pnpm install
pnpm run build
```

O build gera o conteúdo estático em `dist/`. Esse diretório é versionado de propósito, pois o deploy Git da hospedagem não executa o build Node automaticamente.

## Próximo incremento

O próximo passo é o backoffice: login administrativo, fila de perfis pendentes, aprovação/reprovação e destaque de perfis. Não publique o formulário antes de configurar o banco e a moderação.
