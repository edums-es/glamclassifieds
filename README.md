# TheSex — MVP moderado

Marketplace de perfis com frontend React e API PHP 8/MySQL. A aplicação é desenhada para publicar somente perfis que passaram por análise manual.

## Funcionalidades prontas

- Catálogo público, busca e filtros.
- Página individual de perfil.
- Formulário de envio com 1 a 5 fotos, validação de arquivo e proteção básica contra spam.
- Perfis enviados entram como `pending` e não ficam visíveis publicamente.
- Área `/admin` protegida por sessão para analisar, publicar, recusar, arquivar e destacar perfis.
- Troca de senha administrativa e histórico das ações de moderação.
- Build estático em `dist/`, pronto para hospedagem compartilhada sem Node no servidor.

## Instalação na hospedagem

1. Crie um banco MySQL vazio no painel da hospedagem.
2. Faça o deploy dos arquivos e abra `/install`.
3. Informe as credenciais do banco e o e-mail/senha do primeiro administrador.

O instalador grava `api/.env`, cria as tabelas, prepara os uploads e se bloqueia após concluir. Esse arquivo não entra no Git.

Como alternativa para ambientes já configurados, o script CLI `api/scripts/create_admin.php` cria um novo administrador pelo terminal. A pasta de scripts é bloqueada para acesso web.

## Desenvolvimento

```bash
pnpm install
pnpm run build
```

O build gera `dist/`, mantido no Git intencionalmente para que um deploy por Git não precise executar Node no servidor.

## Publicação futura

A publicação será feita depois dos testes funcionais locais. Para uma hospedagem Apache, a raiz do repositório usa `.htaccess` para servir o React de `dist/` e preservar a API em `/api`.

O roteiro completo de validação está em `docs/roteiro-de-teste.md`.
