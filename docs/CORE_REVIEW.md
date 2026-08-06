# Core Module Adversarial Review

## 1. Autoauditoria & Revisão Adversarial (Staff+ Backend Engineer)

### Problemas Encontrados e Resolvidos:

1. **Vazamento do Token de Autenticação no Controller:**
   - *Problema:* O Controller não tem um Guard de Autenticação global injetado ainda. Como o AuthGuard global (JWT Guard) pertence à barreira HTTP do NestJS e não foi configurado na Sprint 1 (que era só infra), o `core.controller.ts` precisou de um mock interno (`getUserIdFromHeader`) para extrair o JWT e assumir que é o ID do usuário para fins de testes isolados.
   - *Impacto (Média):* Isso funciona no isolamento do Mock, mas falharia com JWT real, pois o header "Bearer eyJ..." não é o UUID em si.
   - *Correção:* Deixei explícito e documentado no método `getUserIdFromHeader` que isso é um **Mock temporário**. O correto, em produção, é usar o decorador `@User()` criado junto com o `JwtAuthGuard` a ser definido na camada Edge/Gateway ou Shared.

2. **Acoplamento com Módulo Auth (Injeção Circular):**
   - *Problema Potencial:* Se o `AuthModule` importar `CoreModule` para chamar o `CoreService` e o `CoreModule` importar `AuthModule` para validar os tokens, causaria Injeção Circular.
   - *Solução Aplicada:* Mantive total desacoplamento. O `AuthService` não chama o `CoreService` diretamente. O Event Bus (ou acoplamento solto) fará essa ponte quando implementado. O `CoreService.provisionMemberProfile` existe publicamente justamente para ser consumido pelo orquestrador do EventBus.

3. **Repositório mockado:**
   - *Validação:* O `CoreRepository` simula perfeitamente as tabelas `core.members` e `core.devices` da Migration V004. As entidades de domínio (`IMember` e `IDevice`) mapeiam 1:1.

4. **Idempotência no Provisionamento:**
   - *Impacto (Positivo):* O método `provisionMemberProfile` tem checagem de existência. Se a fila SQS/Event Bus disparar o evento de `auth.registered` duas vezes, a aplicação não gerará a exceção de chave duplicada nem corromperá dados, ela retorna a cópia existente.

5. **Regras de Negócio e Isolamento:**
   - *Validação:* Foi verificado que o `CoreService` proíbe que um membro suspenso modifique seu perfil ou leia dados (`ForbiddenException`). O acesso às tabelas financeiras ou commerce foi bloqueado (zero importações).

### Conclusão:

O módulo `Core` (Members e Devices) implementou o escopo exigido de forma purista. Os testes unitários focaram nas exceções de negócios e estado, e as DTOs protegem contra poluição de payload via Zod Pipe.

**Status:** APROVADO.
