# AXE Despacho Mobile — frentes 07 a 10 (2026-11-07)

O aplicativo Mobile é **exclusivo do AXE Despacho**; não envolve os projetos AXE Voice nem AXE PABX. Mantém central Web/API como única origem dos dados, sem acesso direto ao MySQL.

**Segurança e release:** modo Android nativo permanece `NATIVE_AUTH_PENDING`, sem bypass de autenticação, captura real de GPS ou implantação em produção.

## Frentes implementadas no código (aguardam CI)
- **F07: reconciliação offline.** Reutiliza o validador que já protege a persistência para rejeitar registros malformados, campos não permitidos e status inválidos ao calcular diferenças entre snapshots; não cria nem repete mutações.
- **F08: seleção de organização.** Exige contrato fechado do endpoint `tenant.selection`: exatamente os campos esperados, sem códigos duplicados nem dados extras potencialmente sensíveis. A central continua autoridade final de tenant.
- **F09: interface de erros de API.** Retorna mensagens genéricas para HTTP 401, 403 e 5xx sem refletir erros do servidor no texto exposto; não altera autenticação ou tentativas automáticas. A API preserva o status para atuação adequada do cliente.
- **F10: ergonomia.** Controles essenciais com alvos de toque de 44px e reorganização do cabeçalho em telas de até 375px, preservando foco de teclado e movimento reduzido.

## Evidências da CI
`src/lib/agentOfflineReconcile.test.ts`; `src/lib/tenantSelectionValidation.test.ts`; `src/lib/apiSafeErrors.test.ts`; `src/lib/mobileAccessibilityContract.test.ts`; suíte geral e build do repositório. **Resultados ainda não devem ser tratados como aprovados até publicação dos checks da PR**.

## Validações humanas futuras
Android 14, 15 e 16 em dispositivos físicos, comportamento iOS/PWA, GPS foreground/background, perda de rede, reautenticação, leitor de tela, contrastes, 320/375px reais, mudanças de tenant e nenhuma gravação de PII em cache. Nenhum desses gates é automaticamente aprovado por testes sintéticos.
