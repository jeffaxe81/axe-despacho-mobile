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
| Validação estrita da página de ocorrências e confirmação de logout | Implementado no PR de robustez mobile; CI e testes reais pendentes |\n| Revogação de sessão em consultas/mutações e erros HTTP 401/403 | Implementado em branch de robustez, aguardando validação de CI |\n| GPS laboratório: indicação de captura recente/atrasada sem coordenadas | Implementado em branch de robustez, aguardando CI Android |\n| Testes visuais 320–1024px, rede, bateria e permissões | Pendente |

**Prioridade:** Android primeiro. iOS será retomado após validação do fluxo Android. A distribuição GitHub permanece pública, sem chaves, credenciais ou certificados no código.\n\nNão reportar conclusão de release sem CI verde, testes de dispositivo e validação real com servidor e contas de agentes. O repositório da central `dispatch` mantém seu PR independente.

