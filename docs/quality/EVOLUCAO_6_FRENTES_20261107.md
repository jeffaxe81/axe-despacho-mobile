# AXE Despacho Mobile — incremento de seis frentes (07/11/2026)

**Status:** código de desenvolvimento/CI. O teste em emulador Android **não** aprova uso de campo nem distribuição iOS.

## Três frentes do Mobile

| Frente | O que muda | Como validar |
| --- | --- | --- |
| 4 — Situação operacional | A tela informa se está pronta, verificando, ocupada ou bloqueada por rede, sessão, conflito ou dados antigos | `fieldOperationalState.test.ts`, nunca usando o aviso como autorização |
| 5 — Persistência temporária | O resumo offline exige somente campos permitidos, envelope exato, escopo correto e relógios válidos; apaga payload suspeito | `agentOffline.test.ts`, verificações de LGPD, expiração e sem replay |
| 6 — Acessibilidade | Link para pular ao conteúdo, indicação de seleção da ocorrência para leitor de tela, rede anunciada, foco e movimento reduzido | `mobileAccessibilityContract.test.ts` e avaliação humana posterior |

## As três frentes complementares da central

1. Ordem SQL determinística para ocorrências com mesmo timestamp.
2. Pesquisa por símbolos literais (sem wildcard acidental) em consultas tenant-aware e legadas.
3. Proteção temporal de amostras GPS antes da persistência de localização.

Documentação técnica detalhada: `jeffaxe81/dispatch/docs/quality/EVOLUCAO_6_FRENTES_20261107.md`.

## Etapas que permanecem pendentes

- **ANDROID-AUTH:** OAuth2/OIDC + PKCE, Keystore, expiração e revogação em aparelho físico.
- **ANDROID-GPS:** rastreamento real de segundo plano e consentimento operacional, exigindo central integrada.
- **ANDROID-E2E:** redes móveis, perda de sinal, retomada de sessão e acessibilidade real Android 14–16.
- **IOS-RELEASE:** testes e distribuição iOS.

Os gates de `docs/quality/mobile-release-gates.json` permanecem como `PENDING_REAL_ENVIRONMENT`. O status operacional mostrado na tela é apenas **explicação de UX**: o controle original ainda exige autorização, snapshot fresco, primeiro plano e ausência de conflitos.
