# AXE Despacho Mobile — preparação da revisão independente F04

**F04: PENDENTE (0% de aceite formal).** Documento de entrada para o revisor, não conclusão de segurança Android/iOS.

## Evidências de desenvolvimento disponíveis
- [Relatório de passagem de fases](./PHASE_HANDOFF_REPORT.md)
- [PR #22 — auditoria de fases](https://github.com/jeffaxe81/axe-despacho-mobile/pull/22)
- [PR #23 — testes sintéticos de pré-homologação](https://github.com/jeffaxe81/axe-despacho-mobile/pull/23)
- [Issue #4 — autenticação nativa](https://github.com/jeffaxe81/axe-despacho-mobile/issues/4)
- [Issue #5 — GPS em background](https://github.com/jeffaxe81/axe-despacho-mobile/issues/5)

## Trabalho técnico verificável a executar
1. Revisar o bloqueio de login e requisições operacionais do APK enquanto o contrato nativo Android/OAuth PKCE, App Links, revogação e Android Keystore não forem homologados.
2. Revisar GPS, consentimento, encerramento, bateria, privacidade e ausência de envios autenticados do laboratório para a central.
3. Revisar as chamadas PWA same-origin HTTPS, rejeição de redirects e escopos organizacionais; manter sem bypass de CORS.
4. Validar cache de ocorrências: somente `id/code/category/status`, limite/TTL, rejeição de campos inesperados (endereço/descrição/coordenadas), duplicidade, limpeza e não reexecução automática de comandos.
5. Revisar saída entre abas e o tratamento fail-closed quando o armazenamento da origem é limpo, sem assumir que a sessão remota foi encerrada.
6. Registrar achados, medidas, responsável, parecer independente e commit sob revisão. Testes sintéticos não substituem testes Android 14–16 em dispositivos.

## Critérios documentais de passagem
- Evidência vinculada a commit, resultado de testes e negativos relevantes.
- Revisor independente, distinto do autor, decisão e data UTC; validação humana dos artefatos.
- Controle de fase verifica **metadados**, não comprova autenticidade remota de uma aprovação.
- F05 exige validação separada de ANDROID-AUTH, ANDROID-GPS, ANDROID-E2E e IOS-RELEASE.

**F04/F05/F06 continuam PENDENTES e a produção permanece NÃO AUTORIZADA.**
