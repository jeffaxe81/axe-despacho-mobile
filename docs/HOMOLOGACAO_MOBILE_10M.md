# AXE Despacho Mobile — 10 milhões de avaliações sintéticas

**Ciclo:** 07/11/2026 · **Ambiente:** CI isolada de pré-produção · **Situação:** a aprovação depende da execução completa das dez partições e do agregador.

## Objetivo e escopo

Complementar as 2.000 verificações da PR #23 e as suítes anteriores com uma bateria massiva de **10.000.000 de avaliações determinísticas de cenários** em código real. O runner exercita funções de produção com combinações geradas por PRNG de semente fixa e as compara com oráculos separados de comportamento esperado. Cada resultado é interrompido na primeira discrepância e informa partição, posição, semente e entrada gerada para reprodução.

**Distinção crucial:** são **10.000.000 de avaliações** agrupadas em **10 testes Vitest de longa execução**, e não 10 milhões de registros separados no relatório Vitest, nem 10 milhões de casos exclusivos, instalações de APK, testes end-to-end ou homologações em dispositivos físicos. Valores de entrada podem se repetir. Não são feitas conexões à API operacional, GPS real, armazenamento de usuários ou produção.

## Distribuição de 10 × 1 milhão

| Partição | Avaliações | Validações |
| --- | ---: | --- |
| `rbac` | 1.000.000 | Papel, atividade, usuário/equipe, organizações e permissões |
| `incident_contract` | 1.000.000 | Contratos de ocorrências, team-scope, revisão, formatos, páginas e duplicidade |
| `team_snapshot` | 1.000.000 | Consistência das atribuições, filtros, concorrência simulada e ocorrências além da primeira página |
| `session_epoch` | 1.000.000 | Revogação, troca de escopo, autenticação concorrente e rejeição de tickets antigos |
| `freshness` | 1.000.000 | Limites de validade do snapshot, relógio e mensagens de sincronização |
| `lifecycle` | 1.000.000 | Conectividade, app em primeiro/segundo plano, bloqueio nativo e erros de autorização |
| `gps_integrity` | 1.000.000 | Latitude, longitude, precisão e timestamps válidos/inválidos |
| `gps_antireplay` | 1.000.000 | Cadência de tentativas, GPS antigo, reenvio e ledger volátil em subconjunto |
| `offline_privacy` | 1.000.000 | Dados redigidos, isolamento de escopo, expiração, adulteração e notas |
| `logout_security` | 1.000.000 | Logout pendente, storage não gravável, sinalização entre abas e revogação |
| **Total** | **10.000.000** | **10 partições verificáveis** |

## Execução reproduzível

```bash
npm ci
MOBILE_FUZZ_GROUP=rbac npm run test:10m:shard
MOBILE_FUZZ_GROUP=team_snapshot npm run test:10m:shard
# Executar todas as 10 partições, cada uma produzindo um receipt JSON.
node scripts/quality/verify-ten-million.mjs
```

A automação `Mobile 10M synthetic pre-homologation` executa cinco partições em paralelo (até dez no total), sem repetir esse processamento pesado a cada build Android normal. Cada uma produz `artifacts/ten-million/receipt-<grupo>.json` contendo `seed`, `evaluations=1000000`, `failures=0` e fingerprint determinístico. O job agregador faz uma validação fail-closed: **sem exatamente dez recibos íntegros e 10.000.000 de avaliações, a etapa falha**. O resumo da CI lista contagens, seeds e fingerprints. Os recibos CI ficam como artifacts GitHub por 14 dias.

## Política de aceite

- Falha de qualquer avaliação, timeout de partição, erro de geração/contagem ou recibo ausente reprova o gate.
- Verificar separadamente os workflows `Mobile quality` e `Android APK (debug)` no SHA final antes de qualquer integração.
- Permanecem pendentes os gates reais `ANDROID-AUTH`, `ANDROID-GPS`, `ANDROID-E2E` e `IOS-RELEASE` de `docs/quality/mobile-release-gates.json`.
- A execução desta bateria **não** autoriza login nativo, GPS operacional, migração, deploy, liberação para operadores ou produção.

## Limitação metodológica

Um grande volume de entradas produz confiança estatística adicional sobre *funções isoladas*, mas não substitui integração de autenticação nativa, testes de carga em servidor real, testes com GPS/energia/permissões em Android 14–16, verificação visual em telas reais, segurança ofensiva revisada ou validação de distribuição iOS. A conclusão dessas etapas exige ambiente isolado, responsáveis e evidências externas sanitizadas.
