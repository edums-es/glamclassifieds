# Roteiro de validação do MVP

Este roteiro confirma o fluxo principal antes da publicação. Faça-o em um ambiente de teste com PHP 8 e MySQL configurados.

## Preparação

1. Importe `database/schema.sql` em um banco vazio.
2. Copie `api/.env.example` para `api/.env` e preencha os dados do banco.
3. Garanta escrita para `api/uploads/`.
4. Crie um acesso administrativo:

```bash
php api/scripts/create_admin.php admin@exemplo.com uma-senha-forte-com-12-caracteres
```

5. Confirme que `GET /api/v1/health` responde com `{"status":"ok"}`.

## Fluxo principal

1. Abra `/create` e envie um perfil com nome, idade entre 18 e 99 anos, cidade, valor e de uma a cinco imagens JPG, PNG ou WEBP menores que 5 MB.
2. Confirme que a mensagem informa que o perfil está em análise.
3. Confirme que esse perfil não aparece no catálogo público da página inicial.
4. Abra `/admin`, entre com o acesso criado e verifique o perfil na aba **Pendentes**.
5. Publique o perfil. Ele deve sair da fila pendente e aparecer na aba **Publicados**.
6. Atualize a página inicial e confirme que o perfil aparece. Abra-o para validar fotos, dados e descrição.
7. No painel, marque-o como destaque e confirme que ele fica primeiro no catálogo.
8. Recuse ou arquive outro perfil de teste e confirme que ele não aparece publicamente.
9. Em **Segurança e últimas ações**, altere a senha e confirme que o histórico registra a operação. Saia e entre novamente usando a nova senha.

## Critérios de aprovação

- Não há erro 500 nas rotas públicas, no envio ou no painel.
- Um perfil só é público após ação explícita de publicação.
- A sessão administrativa não é aceita sem login.
- Imagens inválidas, mais de cinco imagens ou campos obrigatórios ausentes são recusados.
- A troca de senha exige a senha atual e uma nova senha com ao menos 12 caracteres.
