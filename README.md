# TheSex — MVP moderado

Marketplace de perfis com frontend React e API PHP 8/MySQL. A aplicação é desenhada para publicar somente perfis que passaram por análise manual.

## Funcionalidades prontas

- Catálogo público, busca e filtros.
- Página individual de perfil.
- Formulário de envio com 1 a 5 fotos, validação de arquivo e proteção básica contra spam.
- Perfis enviados entram como `pending` e não ficam visíveis publicamente.
- Área `/admin` protegida por sessão para analisar, publicar, recusar, arquivar e destacar perfis.
- Build estático em `dist/`, pronto para hospedagem compartilhada sem Node no servidor.

## Banco de dados e primeiro administrador

1. Importe `database/schema.sql` em um banco MySQL vazio.
2. Copie `api/.env.example` para `api/.env` e preencha as credenciais do banco.
3. Crie o primeiro acesso administrativo pelo terminal, a partir da raiz do repositório:

```bash
php api/scripts/create_admin.php admin@exemplo.com uma-senha-forte-com-12-caracteres
```

O script é somente de linha de comando e a pasta `api/scripts` é bloqueada para acesso web. Depois, acesse `/admin` e use esse e-mail e senha.

## Desenvolvimento

```bash
pnpm install
pnpm run build
```

O build gera `dist/`, mantido no Git intencionalmente para que um deploy por Git não precise executar Node no servidor.

## Publicação futura

A publicação será feita depois dos testes funcionais locais. Para uma hospedagem Apache, a raiz do repositório usa `.htaccess` para servir o React de `dist/` e preservar a API em `/api`.
