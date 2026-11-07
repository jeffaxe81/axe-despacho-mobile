# AXE Despacho Mobile — proteção de seleção de organização

**Status:** testes de contrato HTTP simulado + validação de DTO no cliente. Sem produção, sem autenticação nativa.

## Correção implementada

`src/lib/tenantSelectionValidation.ts` valida o resultado de `tenant.selection` **antes** de o bootstrap do agente aceitar a sessão. Rejeita:

- Organização fora da lista elegível ou IDs inválidos/duplicados.
- `requiresSelection` incoerente com quantidade de empresas e escolha ativa.
- Campos de organização ausentes, vazios, com caracteres de controle ou tamanhos excessivos.
- Lista anormalmente grande ou payload com formato incorreto.
- Seleção única não ativa ou lista vazia que tente declarar empresa selecionada.

`api.tenant()` lança `INVALID_TENANT_SELECTION` sem ativar controles caso ocorra incompatibilidade. Em erros HTTP 401/403, preserva-se a revogação existente. Nativo permanece bloqueado por `NATIVE_AUTH_PENDING`.

## Evidências automatizadas

`src/lib/tenantSelectionValidation.test.ts` inclui casos de payload autorizado, falsificado, inválido, erro HTTP e WebView nativo; os testes de transporte e 10 milhões de cenários continuam complementares.

A central recebe o teste de adaptador HTTP em processo `server/mobileTenantHttpContract.test.ts` (PR específica em `jeffaxe81/dispatch`). Sua fonte de organizações é simulada, mas o roteador tRPC real é executado.

## Limite de homologação

**Testes simulados não provam login operacional real.** O fluxo com backend isolado deve ser registrado na issue [#253](https://github.com/jeffaxe81/dispatch/issues/253), incluindo cookies HTTPS, sessão ativa/expirada, multi-tenant e erro de vínculo. O Android nativo e GPS em segundo plano continuam aguardando seus gates próprios.

O manifesto `docs/quality/mobile-release-gates.json` **não foi modificado**.
