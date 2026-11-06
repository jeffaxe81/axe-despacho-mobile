# Entregas e validação

| Etapa | Situação |
| --- | --- |
| Novo repositório separado da central | Criado |
| Estrutura React/Capacitor e CI | Código no PR de fundação |
| Telas de agente, login e ocorrências | Implementação inicial (sem homologação real) |
| Consumo de API autenticada na mesma origem | Adaptador preparado; teste com backend real pendente |
| Persistência opt-in de resumo redigido | Implementação inicial com testes unitários |
| GPS enquanto app ativo | Implementação inicial; teste com dispositivos pendente |
| Autenticação nativa Android/iOS | Backend: contratos e MySQL descartável homologados nas PRs #243–#247; login operacional ainda desabilitado |
| GPS nativo Android de laboratório (sem envio à central) | Código de Foreground Service e notificação no APK debug; testes em dispositivo pendentes |\n| PKCE Android e preparação de cofre Keystore (sem login) | Laboratório nativo de geração S256, cofre AES-GCM e controles de build; App Links e endpoints operacionais continuam pendentes |
| Serviço GPS operacional autenticado | Pendente: autorização do agente, vínculo à central e teste de campo |
| SQLite criptografado / fila idempotente | Pendente: contrato de backend e auditoria |
| APK de teste Android | Automação de montagem debug no GitHub Actions; homologação em dispositivo pendente |
| APK de produção e IPA distribuível | Pendente: autenticação nativa, assinatura/requisitos e homologação |
| Cliente de campo: atualização automática e limite de validade | Integrado à main; homologação de API/uso real pendente |
| Simulador Android de ocorrências fictícias | Integrado à main, sem acesso à API nem a dados reais |
| Logout remoto pendente com bloqueio persistente | Integrado à main no PR #8; homologação de sessão real pendente |
| Validação estrita da página de ocorrências e confirmação de logout | Integrado na main via PR #9; homologação real pendente |\n| Revogação de sessão em consultas/mutações e erros HTTP 401/403 | Integrado na main via PR #10; homologação real pendente |\n| GPS laboratório: indicação de captura recente/atrasada sem coordenadas | Integrado na main via PR #10; testes físicos pendentes |\n| 1.000 cenários automatizados (contrato, RBAC, sincronização e GPS) | Em PR de teste/hardening; comprovar execução e builds verdes no mesmo SHA |\n| GPS: evitar replay de captura e limitar tentativas de envio | Implementado em branch; aguardando CI e homologação backend/dispositivo |\n| Autorização: IDs e organizações válidos, revogação ao negar GPS | Implementado em branch; aguardando CI |\n| Contagem de ocorrências ativas além da primeira página de 50 | Implementação com filtros por status e validação cruzada; em PR, aguardando CI e homologação real |\n| Testes visuais 320–1024px, rede, bateria e permissões | Pendente |

**Prioridade:** Android primeiro. iOS será retomado após validação do fluxo Android. A distribuição GitHub permanece pública, sem chaves, credenciais ou certificados no código.

Não reportar conclusão de release sem CI verde, testes de dispositivo e validação real com servidor e contas de agentes. O repositório da central `dispatch` mantém seu PR independente.


## Auditoria de consistência das atribuições

Novo gate local de consistência: o total de ocorrências ativas nunca pode superar o total geral; se a equipe possui até 50 ocorrências, todas as ocorrências ativas retornadas por filtros devem existir na página geral; divergências de dados de um mesmo incidente entre as quatro consultas exigem revalidação e bloqueiam comandos/GPS. Testes de regressão incluem casos válidos de limite de página e resultados contraditórios. A consistência transacional atômica da central ainda depende de suporte no backend e testes integrados.

## Segurança contra respostas tardias (ciclo de seis frentes)

- Implementação cliente: tickets voláteis para autenticação, logout, revogação, troca de tenant e consultas/mutações em voo; solicitações antigas não reativam a UI.
- Android: regressão do bloqueio `NATIVE_AUTH_PENDING` para todas as operações autenticadas, incluindo GPS; sem envio de credenciais pela WebView.
- Entrega em branch com CI obrigatório: teste de corrida, matriz existente de 1.000 cenários, build web e Gradle APK debug.
- Ainda bloqueado: contrato de autenticação no backend, Android Keystore, App Links/PKCE, E2E com servidor real e teste de campo Android 14–16.


## Laboratório Android de autenticação nativa (quatro frentes)

- Código Java **debug-only** prepara um desafio PKCE S256 local, com 256 bits de aleatoriedade, sem enviar o `code_verifier` ao JavaScript ou conectar à central.
- Cofre Android Keystore AES-GCM implementado como classe de uso exclusivo nativo, mas ainda **não armazena handles operacionais** nem possui ponte JavaScript para senhas/tokens.
- Verificação do APK impede ativação do login operacional, App Link sem domínio aprovado e exposição de credenciais. [Contrato e limitações](ANDROID_NATIVE_AUTH_LAB.md).
- Próximos gates: servidor OAuth/PKCE aprovado no `dispatch`, App Links verificados, troca nativa auditada, credenciais protegidas, revisão de segurança e testes Android 14–16 reais; GPS produção continua bloqueado.

## Retorno nativo OAuth — contrato de segurança (sem habilitar login)

- Incluído `AxeNativeCallbackGuard.java`, que verifica URL HTTPS exata, emissor `iss`, `state` de uso único, prazo de 5 minutos e impede replay/duplicidade; o callback ainda **não** está conectado ao aplicativo nem ao servidor.
- Criado teste nativo executado em Java 21 no workflow Android, incluindo URLs hostis e 32 tentativas concorrentes.
- O instalador Android desativa o backup automático (`android:allowBackup=false`), preservando o bloqueio de App Links não verificados.
- Referência técnica: [validação nativa de retorno OAuth](ANDROID_NATIVE_CALLBACK_GUARD.md).
- Aguardam domínio oficial da central, assinatura/assetlinks, implementação auditada do navegador do sistema, troca de código/token apenas nativa e testes de dispositivo físico. `NATIVE_AUTH_PENDING` permanece ativo.
