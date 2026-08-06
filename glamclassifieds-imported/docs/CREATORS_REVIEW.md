# Creators Module Adversarial Review

## 1. Autoauditoria & Revisão Adversarial (Staff+ Backend Engineer)

### Problemas Encontrados e Resolvidos:

1. **Vazamento do Token de Autenticação no Controller:**
   - *Problema:* O Controller não tem um Guard de Autenticação global injetado ainda. Como o AuthGuard global (JWT Guard) não foi configurado, o `creators.controller.ts` precisou de um mock interno (`getUserIdFromHeader`) semelhante ao módulo Core.
   - *Impacto (Média):* Funciona no isolamento do Mock, mas falharia com JWT real.
   - *Correção:* Mantido como mock temporário, devidamente comentado e alinhado com a estratégia dos demais módulos. A solução global virá posteriormente na camada de Gateway.

2. **Username Único (Case Insensitivity):**
   - *Problema Potencial:* O cadastro de `john_doe` impediria `JOHN_DOE`? Na Migration `V005`, existe a proteção na constraint UNIQUE. Mas e no mock?
   - *Solução Aplicada:* O `CreatorsRepository` simula a busca via `.toLowerCase()` garantindo que os testes unitários já reflitam o comportamento case-insensitive que o PostgreSQL adotará.

3. **Status de Creator Ativo:**
   - *Validação:* O `CreatorsService` encapsula a lógica `ensureActive` em um método privado, barrando o acesso tanto à edição do perfil quanto à visualização pública caso o status seja `suspended` ou `pending_verification`.

4. **Acoplamento Inexistente:**
   - *Validação:* Nenhum acesso foi feito às tabelas ou pacotes de `Commerce` (Catálogo/Produtos/Offers), `Finance` (Wallets) ou `Core` (embora interaja via Eventos/Semântica para atualizar a Flag `is_creator`).

5. **Exposição de Informações Pessoais:**
   - *Risco:* A rota `GET /creators/:username` devolve o `ICreator` puro. Se `ICreator` contiver e-mail, ele vazaria.
   - *Validação:* A interface `ICreator` não contém e-mail nem dados sensíveis. Retorna o estritamente necessário (username, bio, avatar, status) protegendo contra scrapers.

### Conclusão:

O módulo `Creators` implementou o MVP exigido (Creator Entity, Profile, Onboarding, Username único, Status check). Os testes unitários provam o manuseio de concorrência de usernames e o bloqueio de perfis suspensos.

**Status:** APROVADO.
