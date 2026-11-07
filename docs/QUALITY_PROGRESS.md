# Evolução mensurável — AXE Despacho Mobile

Este ciclo registra os percentuais **de homologação real**, distintos dos percentuais de execução de testes automatizados. Nenhum percentual representa a conclusão global do produto.

- **CI técnica:** verificar independentemente os workflows `Mobile quality` e `Android APK (debug)`; nunca presumir aprovação a partir do manifesto.
- **Homologação Android/iOS:** `npm run readiness:mobile` lê `docs/quality/mobile-release-gates.json` e calcula a proporção de gates reais com evidência válida.
- **Critérios obrigatórios:** `ANDROID-AUTH`, `ANDROID-GPS`, `ANDROID-E2E`, `IOS-RELEASE`.
- **Situação inicial (07/11/2026):** 0/4 gates com evidência operacional, **0%**, `NO_GO`.
- **100% de evidências** resulta em `MANUAL_GO_REVIEW_REQUIRED`; não aprova deploy nem habilita GPS/login.
- Não usar resultados simulados do APK debug como homologação com dispositivos e backend reais.

**Como evoluir com rastreabilidade:** executar homologação isolada, registrar responsável, timestamp UTC e URL HTTPS de evidência sanitizada para cada gate. Atualizar apenas os gates comprovados. Revisão de segurança e aprovação de implantação permanecem separadas; o repositório público não pode conter segredos.

Testes: `npm run test:readiness`. O CI executa testes de regressão, gera sumário de progresso e preserva o bloqueio de produção.
