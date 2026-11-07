# APIs abertas e contratos — AXE Despacho Mobile

**Situação:** documentação e proposta. Nenhum endpoint REST público ou login nativo foi habilitado neste ciclo.  
**Fonte consultada:** `src/lib/api.ts` do Mobile e `server/routers.ts` / `server/openapi.ts` do backend `jeffaxe81/dispatch`, em 07/11/2026. Verificação no código **não substitui** teste de disponibilidade em ambiente real.

## 1. Qual API existe hoje?

O Mobile utiliza **tRPC HTTP + SuperJSON**, através de `/api/trpc/<procedimento>`. No navegador, a autenticação usa cookies HTTP-only, `credentials: "include"`, origem HTTPS idêntica à central e cabeçalho `x-organization-id` quando aplicável. Não existe acesso direto ao banco. Requisições de leitura podem ser canceladas, escritas não devem ser reproduzidas automaticamente após timeout.

| Recurso | Procedimento | Modo | Situação de código |
| --- | --- | --- | --- |
| Verificar usuário | `auth.me` | Query | Localizado no backend |
| Entrar (somente PWA de mesma origem) | `auth.login` | Mutation | Localizado no backend |
| Sair | `auth.logout` | Mutation | Localizado no backend |
| Selecionar tenant | `tenant.selection` | Query | **Não localizado no roteador principal inspecionado** |
| Ver permissões | `access.me` | Query | Localizado no backend |
| Listar atribuições | `incidents.list` | Query | Localizado no backend, exige `occurrences.view` |
| Aceitar/recusar | `incidents.respondToAssignment` | Mutation | Localizado no backend, verifica agente/equipe |
| Transição de situação | `incidents.transition` | Mutation | Localizado no backend, revisão e permissão |
| Registrar posição | `teams.recordLocation` | Mutation | Localizado no backend; sem homologação operacional Android |
| Catálogo OpenAPI interno | `integrations.openapi.internal` | Query | Existe na central; requer `apidocs.view`, contratos de **simulação** |

**Atenção:** `auth.me` e `auth.login` aparecem como `publicProcedure` no tRPC, mas isso não torna a API de operações aberta ou sem autenticação. As demais ações de campo passam por procedimentos operacionais protegidos e validações de equipe e organização.

O catálogo em JSON auditável para ferramentas e revisores está em [mobile-api-catalog.json](api/mobile-api-catalog.json).

## 2. Integrações públicas — desenho recomendado

Documentei um **rascunho OpenAPI 3.1**, em [openapi-external-proposal.yaml](api/openapi-external-proposal.yaml), com endereço `https://api.example.invalid`. Ele não foi implantado e não deve ser usado por clientes externos. O projeto requer uma camada no **backend** com contratos versionados, nunca uma rota anônima adicionada ao Mobile.

### Trilha A — API autenticada de consulta (primeiro release)

- Gateway REST `/v1` dedicado, `OAuth 2.0` com PKCE para clientes públicos e credenciais de cliente para integrações servidor-servidor aprovadas.
- Escopos mínimos (`field.read`), vínculo confirmado de organização/equipe **no servidor**, paginação/cursor e snapshotVersion.
- Controle de quota, correlação, auditoria sanitizada, documentação de erros e revogação.
- Testes: agentes de outras equipes, tokens expirados, consultas sem permissão, CORS, TLS, carga e bloqueio de enumeração.

### Trilha B — Escritas auditadas (dependem da A)

- Implementar `field.transition` somente para atribuições autorizadas, revisão esperada e **Idempotency-Key** validada no servidor.
- Respostas `409` em versão conflitante; repetir somente mediante consulta de status e reconciliação.
- Rate limiting, trilha de auditoria, segregação de permissões, testes de concorrência e recuperação de falha.

### Trilha C — Eventos/webhooks

- Webhooks por organização, assinatura HMAC, antirreplay com janela temporal, entrega reprocessável/observável e DLQ no servidor, sem dados pessoais desnecessários.
- Versão de evento, contrato de retenção, opt-in, política de rotação de segredos e eventos de teste.

## 3. Restrições de segurança e privacidade

**Nunca** expor MySQL, tokens/segredos em repositório público, chamadas diretas de terceiro à WebView, permissões administrativas para agentes ou endpoints públicos anônimos de mudança de ocorrência/GPS. As credenciais de integração devem ser segregadas em vault no backend; Android usará Keystore quando o contrato nativo for aprovado. Requer LGPD, minimização dos campos, propósito, expurgo e auditoria.

## 4. Critérios para afirmar que uma API está aberta para parceiros

1. Implementação na central em branch/PR própria e contrato versionado.
2. Autenticação/aprovação de clientes, autorização efetiva no backend, endpoints de teste isolados.
3. OpenAPI gerado ou validado contra comportamento real, esquema de erros, limites e exemplos sem segredos.
4. CI verde, testes integrados de tenant cruzado, idempotência, concorrência, expiração e revogação.
5. Manual de adesão, política de versões/depreciação, observabilidade e aceite de segurança.

**Gap P0:** a chamada `tenant.selection` do Mobile não foi encontrada no `appRouter` inspecionado, embora usada no fluxo de autenticação web. Resolver isso antes de qualquer declaração de integração PWA comprovada. Consulte [lacunas e tratamento](LACUNAS_E_TRATAMENTO.md).
