# AXE Despacho Mobile — bateria de 2.000 cenários de pré-homologação

**Data do ciclo:** 07/11/2026  
**Escopo:** mobile React/Capacitor, Android prioritário e preparação iOS.  
**Natureza da evidência:** testes automatizados **sintéticos** de regras do cliente. Não há utilização de telefone físico, WebView instrumentada, central de homologação, GPS real, rede celular ou credenciais operacionais.

## Matriz executável

| Bloco | Cenários | Cobertura | Teste |
| --- | ---: | --- | --- |
| A | 200 | RBAC: usuário ativo, papéis, permissões e organização | isFieldUser |
| B | 200 | DTO de ocorrências, formato, prioridade, revisão e isolamento de equipe | validateAssignmentResult |
| C | 200 | Lista com mais de 50 ocorrências, conflitos, filtros, paginação e cancelamento | loadVerifiedTeamSnapshot |
| D | 200 | Sessão, logout, troca de equipe, login concorrente e respostas tardias | SessionEpoch |
| E | 200 | GPS: latitude, longitude, precisão, timestamps e limites de validade | validLocation |
| F | 200 | GPS: replay, cadência, troca de organização/equipe e falhas de captura | GpsAttemptLedger |
| G | 200 | Cache offline: expiração, minimização de dados, tenant e integridade | agentOffline |
| H | 200 | Rascunhos offline: comprimento, Unicode, expiração, exclusão e isolamento | agentOffline |
| I | 200 | Marcador de logout: corrupção, falha de armazenamento, eventos entre abas | sessionFence |
| J | 200 | Rede, primeiro plano, bloqueio nativo, frescor e rejeição de acesso | clientFreshness, sessionAccess |
| **Total** | **2.000** | **10 classes de riscos × 200 casos** | **2 suites dedicadas** |

Cada cenário tem um nome estável; cada matriz afirma seu próprio tamanho em tempo de coleta dos testes. As combinações são determinísticas, sem acesso a serviços externos ou dados reais. Não se confunde o número de cenários com cobertura percentual de código nem com 2.000 jornadas reais de usuário.

## Execução e evidências

```bash
npm install
npm run check
npm run test:2000
npm test
npm run build
```

O workflow `Mobile pre-homologation 2000 (synthetic)` executa as duas suítes e publica o resultado em GitHub Actions. O workflow de qualidade padrão e o Android APK (debug) executam a suíte de testes integrada, além de seus controles. Para aprovação técnica, conferir que **ambas as suítes passaram no mesmo SHA**, assim como as demais verificações de build e segurança pública. Falha de teste bloqueia merge.

**Rastreabilidade:** arquivos `src/lib/mobileHomologation2000a.test.ts` e `src/lib/mobileHomologation2000b.test.ts`, script `test:2000` em `package.json` e relatório de execução do workflow na PR.

## Limites e próxima homologação real

A bateria acima não altera `docs/quality/mobile-release-gates.json` e não marca gates físicos como aprovados. São necessários, **em ambiente de homologação autorizado**, com evidências sanitizadas e responsável designado:

1. **ANDROID-AUTH:** login nativo com PKCE, armazenamento protegido pelo Keystore, revogação, falhas de tokens e isolamento por tenant/equipe.
2. **ANDROID-GPS:** rastreamento com tela bloqueada e foreground service real, economia de bateria, precisão, permissões, perda de rede, temporização e observação na central.
3. **ANDROID-E2E:** operação completa despacho→agente→encerramento no Android 14, 15 e 16, incluindo exceções, concorrência, recuperação e controles de segurança.
4. **IOS-RELEASE:** autenticação, ciclo de vida, permissões, testes físicos e processo de distribuição revisado em iOS.

Somente relatório com evidência verificável (responsável, timestamp UTC, link HTTPS e resultado dos testes reais) pode elevar o percentual de homologação. A aprovação de CI, mesmo de 2.000/2.000 casos, **não autoriza produção, não habilita login/GPS nativos nem substitui homologação de campo**.
