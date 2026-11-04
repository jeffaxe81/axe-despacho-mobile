# Entregas e validação

| Etapa | Situação |
| --- | --- |
| Novo repositório separado da central | Criado |
| Estrutura React/Capacitor e CI | Código no PR de fundação |
| Telas de agente, login e ocorrências | Implementação inicial (sem homologação real) |
| Consumo de API autenticada na mesma origem | Adaptador preparado; teste com backend real pendente |
| Persistência opt-in de resumo redigido | Implementação inicial com testes unitários |
| GPS enquanto app ativo | Implementação inicial; teste com dispositivos pendente |
| Autenticação nativa Android/iOS | Pendente: trabalho também no backend |
| GPS nativo Android de laboratório (sem envio à central) | Código de Foreground Service e notificação no APK debug; testes em dispositivo pendentes |\n| Serviço GPS operacional autenticado | Pendente: autorização do agente, vínculo à central e teste de campo |
| SQLite criptografado / fila idempotente | Pendente: contrato de backend e auditoria |
| APK de teste Android | Automação de montagem debug no GitHub Actions; homologação em dispositivo pendente |
| APK de produção e IPA distribuível | Pendente: autenticação nativa, assinatura/requisitos e homologação |
| Cliente de campo: atualização automática e limite de validade | Integrado à main; homologação de API/uso real pendente |
| Simulador Android de ocorrências fictícias | Integrado à main, sem acesso à API nem a dados reais |
| Logout remoto pendente com bloqueio persistente | Integrado à main no PR #8; homologação de sessão real pendente |
| Validação estrita da página de ocorrências e confirmação de logout | Integrado na main via PR #9; homologação real pendente |\n| Revogação de sessão em consultas/mutações e erros HTTP 401/403 | Integrado na main via PR #10; homologação real pendente |\n| GPS laboratório: indicação de captura recente/atrasada sem coordenadas | Integrado na main via PR #10; testes físicos pendentes |\n| 1.000 cenários automatizados (contrato, RBAC, sincronização e GPS) | Em PR de teste/hardening; comprovar execução e builds verdes no mesmo SHA |\n| GPS: evitar replay de captura e limitar tentativas de envio | Implementado em branch; aguardando CI e homologação backend/dispositivo |\n| Autorização: IDs e organizações válidos, revogação ao negar GPS | Implementado em branch; aguardando CI |\n| Testes visuais 320–1024px, rede, bateria e permissões | Pendente |

**Prioridade:** Android primeiro. iOS será retomado após validação do fluxo Android. A distribuição GitHub permanece pública, sem chaves, credenciais ou certificados no código.\n\nNão reportar conclusão de release sem CI verde, testes de dispositivo e validação real com servidor e contas de agentes. O repositório da central `dispatch` mantém seu PR independente.

