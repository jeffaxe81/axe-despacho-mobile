# GPS nativo, rastreamento e persistência

## Base implementada

O botão de compartilhamento aparece no atendimento com exatamente uma ocorrência ativa e uma sessão validada. A posição é obtida pelo plugin `@capacitor/geolocation` e enviada para `teams.recordLocation` somente após autorização explícita, respeitando cadência mínima de 20 segundos e descartando coordenadas inválidas ou antigas. O código de hoje não faz rastreamento em segundo plano.

A central deve registrar hora de captura e indicar quando a última posição da equipe está desatualizada. Não presumir que a ausência de sinal significa que a equipe parou.

## Android — implementação nativa pendente

- Serviço de primeiro plano do tipo `location` com notificação persistente durante a jornada.
- Permissões exatas conforme versão Android e tipo de rastreamento, configuradas no Manifest e solicitadas no contexto adequado.
- Início e encerramento explícitos pelo agente; interromper ao terminar atendimento/jornada, sair da conta ou revogar consentimento.
- Estado de bateria, restrições de segundo plano e indisponibilidade visível na central; telemetria mínima, não invasiva.
- Testes com tela bloqueada, economia de bateria, revogação de permissões, reinício do processo e indisponibilidade da rede.

## iOS — implementação nativa pendente

- Core Location com modo `location` de execução em segundo plano e textos de privacidade.
- Consentimento de localização apropriado e avisos claros ao usuário; testar suspensão, bloqueio, bateria e encerramento.
- Distribuição privada legalmente permitida conforme dispositivos e programa Apple aplicável.

## Persistência

A PWA deste ciclo salva, opcionalmente, **apenas** código, categoria e status de até 50 ocorrências durante 15 minutos, por usuário/empresa/equipe. A cópia não substitui uma sessão válida e nunca autoriza mutações offline.

A futura versão nativa poderá usar banco local **criptografado** (por exemplo SQLite + chave protegida pelo Keystore/Keychain) e retentativas com idempotência, desde que exista política de retenção aprovada. Não haverá buffer de GPS ou reenvio automático antes de o backend lidar com pontos antigos, duplicatas e ordem dos eventos.

O objetivo é continuidade de consulta e do fluxo de trabalho sem enfraquecer autorização, privacidade ou integridade operacional.
