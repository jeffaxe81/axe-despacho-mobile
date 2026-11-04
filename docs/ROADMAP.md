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
| Serviço GPS em segundo plano | Pendente: módulo Android/iOS |
| SQLite criptografado / fila idempotente | Pendente: contrato de backend e auditoria |
| APK de teste Android | Automação de montagem debug no GitHub Actions; homologação em dispositivo pendente |
| APK de produção e IPA distribuível | Pendente: autenticação nativa, assinatura/requisitos e homologação |
| Testes visuais 320–1024px, rede, bateria e permissões | Pendente |

**Prioridade:** Android primeiro. iOS será retomado após validação do fluxo Android. A distribuição GitHub permanece pública, sem chaves, credenciais ou certificados no código.\n\nNão reportar conclusão de release sem CI verde, testes de dispositivo e validação real com servidor e contas de agentes. O repositório da central `dispatch` mantém seu PR independente.
