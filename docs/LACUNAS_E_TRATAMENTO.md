# Lacunas (gaps) encontradas e plano de tratamento

**Auditoria:** 07/11/2026 · **Escopo:** fonte Mobile e roteador principal do backend, sem validação com servidor de homologação.  
**Prioridade:** P0 = impede fluxo essencial/release; P1 = impacto relevante de usabilidade/integração; P2 = melhoria posterior.  
**Observação:** uma lacuna de contrato no código não equivale, por si só, à comprovação de falha em produção.

| ID | Prioridade | Lacuna identificada | Tratamento necessário | Aceite verificável |
| --- | --- | --- | --- | --- |
| GAP-01 | **P0 — integração real pendente** | `tenant.selection` **existe** em `server/tenantAwareAppRouter.ts` e é exposto via `typedTenantAwareAppRouter`/`rootRouter`; a inspeção anterior somente de `appRouter` foi incompleta | Não criar rota duplicada; executar teste HTTP de autenticação, seleção de organizações e autorização entre Mobile e backend, corrigindo contrato apenas se o teste revelar divergência | 200 autorizado, 401/403, isolamento multi-tenant, revogação e sessão expirada comprovados |
| GAP-02 | **P0** | Login nativo Android permanece bloqueado por `NATIVE_AUTH_PENDING` | Criar contrato OAuth2/OIDC Authorization Code + PKCE na central, App Link HTTPS verificado, cofre Keystore, expiração e revogação; testes físicos | `ANDROID-AUTH` aprovado com evidência real; sem tokens na WebView |
| GAP-03 | **P0** | GPS operacional com tela bloqueada ainda não envia à central | Vincular serviço Android a sessão nativa e equipe autorizada; sequência/idempotência, restrição de bateria e política LGPD; cenários reais 14–16 | `ANDROID-GPS` com fluxo ida/volta, perda de rede, precisão, permissões e auditoria |
| GAP-04 | **P0** | Homologação ponta a ponta Android e distribuição iOS não concluídas | Dispositivos reais, backend isolado, autorização, UX acessível, acompanhamento, assinatura e distribuição | `ANDROID-E2E` e `IOS-RELEASE` com evidências e decisão GO independente |
| GAP-05 | **P1** | Catálogo OpenAPI disponível no backend é de simulação; falta gateway público REST versionado | Implementar na central API `/v1` autenticada e segregada, começando por consultas. Usar YAML proposto apenas como referência | Contrato OpenAPI validado contra serviço real, RBAC/tenant, rate limit, auditoria e CI |
| GAP-06 | **P1** | Ausência de API de idempotência de escritas validada para uso externo | Implementar `Idempotency-Key` por ator, tenant, recurso e payload; reter resultado pelo prazo contratado; reconciliar timeouts | Testes simultâneos e reenvio com exatamente um efeito persistido |
| GAP-07 | **P1** | Lista Mobile usa primeira página + subconjunto ativo; filtros locais não consultam catálogo completo | Evoluir cursor/paginação, busca **no backend** com escopo e revisão atômica do snapshot; hoje sinalizar limite ao usuário | Busca paginada autorizada, sem dados de outras equipes e sem ocultar conflitos ativos |
| GAP-08 | **P1** | Trilha PWA exige sessão real, mas testes atuais são predominantemente sintéticos e emuladores | Executar integração end-to-end em central isolada; instrumentar redirecionamentos, cookies, logout, 401/403 e acessibilidade | Testes reais reproduzíveis, segredos protegidos e relatório da execução |
| GAP-09 | **P2** | Manual resumido existia apenas em documentação fragmentada | Entregue neste ciclo: manual integrado, oito trilhas, checklist efêmero e matriz de sintomas | Testes UX/teclado + revisão com agentes e suporte |
| GAP-10 | **P2** | Não havia pesquisa rápida local das atribuições carregadas | Entregue neste ciclo: filtros locais por código, categoria e situação, com contagem e opção de limpar | Regressão por estados, acentos, privacidade; nenhum efeito sobre permissões/GPS |
| GAP-11 | **P2** | A evidência de interface em telas pequenas e leitores de tela ainda não foi validada por usuários | Testar manual por voz/leitor, foco, toque, telas 320–768px, textos longos/zoom e contraste | Relatório de acessibilidade/UX e correções priorizadas |

**Acompanhamento na central:** [Issue #253 — alinhar tenant.selection](https://github.com/jeffaxe81/dispatch/issues/253) e [Issue #254 — API REST versionada](https://github.com/jeffaxe81/dispatch/issues/254).

## Sequência recomendada

1. **Concluir contratos e homologação de backend:** homologar GAP-01 e preparar GAP-02 antes de ativar login Android. Manter PWA na mesma origem HTTPS e validar com central descartável.
2. **Fechar autenticação nativa:** revisão de criptografia e autorização (GAP-02). Não desativar bloqueios enquanto faltar teste de revogação/escopo.
3. **GPS/operacional:** após autenticação, implementar GAP-03 com idempotência; validar bateria, permissões e tela bloqueada em Android real.
4. **APIs abertas:** projetar GAP-05 e GAP-06 no **backend**, com portal/guia técnico e versão da especificação que realmente corresponda aos serviços.
5. **Ergonomia e ampliação:** capturar feedback de agentes, supervisão e integração sobre GAP-07/08/11, priorizando o que reduz erros em campo.
6. **Aceite formal:** atualizar `docs/quality/mobile-release-gates.json` apenas com evidência real, responsável e timestamp. CI 100% sozinha não aprova produção.

## Registro de riscos

- **Segurança:** jamais usar CORS irrestrito, desabilitar SameSite ou enviar tokens pela WebView como alternativa a GAP-02.
- **LGPD:** não registrar coordenadas, descrição, endereço ou credenciais em analytics, logs de erro ou checklist de treinamento.
- **Integridade:** nenhuma transição offline deve ser reenviada automaticamente após resposta incerta.
- **Evidências:** distinguir **implementado**, **teste automatizado**, **testado em emulador**, **homologado em ambiente real** e **liberado à produção**.

## Evidência técnica da auditoria

O `src/lib/api.ts` do Mobile contém `tenant.selection`, **implementado** em `server/tenantAwareAppRouter.ts`, composto por `server/typedTenantAwareAppRouter.ts` e publicado em `server/rootRouter.ts` (usado por `server/_core/index.ts`). A ausência no `server/routers.ts` isolado não prova indisponibilidade. A verificação HTTP integrada continua necessária. O `server/openapi.ts` contém catálogo interno de simulação com `https://simulation.invalid/axe-dispatch` e `x-simulation-only`; não representa gateway público pronto.\n