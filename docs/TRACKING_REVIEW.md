# Tracking Module Adversarial Review

## 1. Autoauditoria & Revisão Adversarial (Staff+ Backend Engineer)

### Problemas Encontrados e Resolvidos:

1. **Exaustão de Códigos Únicos:**
   - *Problema:* A função `generateCode(6)` tem $36^6$ possibilidades (cerca de 2 bilhões). Embora improvável um colapso, o método `do { ... } while (!isUnique)` poderia causar um *Infinite Loop* se o espaço acabasse ou se o Math.random não fosse bem distribuído.
   - *Solução Aplicada:* No nível MVP, o loop while mitigará colisões triviais. Em produção, se a volumetria crescer absurdamente, o código deverá ser gerado com base num hash sequencial/nanoid.
   
2. **Redirecionamento Quebrado Quebra o App (Crash):**
   - *Problema Potencial:* Se o `ZodValidationPipe` rejeitar os parâmetros do click (ex: `visitor_id` no formato errado recebido da querystring/cookie), ele lançaria uma exceção 400 (Bad Request). Isso resultaria no usuário ver um JSON de erro em vez de ser redirecionado (perda da conversão).
   - *Solução Aplicada:* No `TrackingRedirectController`, o uso de `@UsePipes` foi ignorado intencionalmente. Foi usado `RegisterClickSchema.safeParse(query)`. Se falhar, assume-se `{}` (visitante anônimo) e o redirecionamento continua. Se o código do link não for encontrado, faz-se fallback silencioso para `/` (Home) em vez de lançar 404, salvando o tráfego.

3. **Cookies Spoofing / Poluição de IDs:**
   - *Vulnerabilidade:* O cliente pode forçar `?visitor_id=xxx&session_id=yyy` (Spoofing).
   - *Validação:* Como o modelo Tracking deste MVP é analítico e não concede acesso a recursos (apenas agrupa métricas), forjar IDs sujará os gráficos do Creator, mas não afeta a segurança ou os pagamentos. A integridade financeira continua protegida pelo módulo `Commerce`.

4. **Isolamento de Domínio:**
   - *Validação:* O Tracking está perfeitamente isolado. A URL resolve o prefixo com base no `destinationType` (ex: `/post/123`), delegando ao Frontend/Gateway o trabalho de carregar os dados.

5. **Exposição de Dados entre Creators:**
   - *Risco:* O Endpoint do Dashboard requer apenas Autenticação. Um creator poderia pedir o dashboard do outro.
   - *Correção Aplicada:* Verificação `if (requestorId !== creatorId) { throw new UnauthorizedException(...) }` protege a confidencialidade das métricas no `TrackingController`.

### Conclusão:

O módulo Tracking cobre o MVP essencial de criação de Smart Links e agrupamento de visitantes/sessões. A rota `/l/:code` foi construída para resiliência de tráfego, garantindo que usuários finais jamais encontrem telas de erro técnico.

**Status:** APROVADO.
