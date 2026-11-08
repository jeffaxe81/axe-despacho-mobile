# AXE Despacho — acompanhamento de precisão GPS e localização híbrida

**Status:** incremento de desenvolvimento para a **PWA autorizada em primeiro plano**. O login Android nativo, GPS com tela bloqueada e envio operacional a partir do APK de laboratório continuam bloqueados até homologação real.

## O que o agente verá

O painel **Localização da equipe** exibirá a precisão horizontal estimada pelo aparelho, em metros, e um indicador atualizado por novas medições do serviço de localização do sistema:

| Qualidade da medição | Precisão horizontal estimada | Tratamento |
| --- | ---: | --- |
| Excelente | 0 a 20 m | Dentro da meta; elegível a envio condicionado à sessão, equipe, permissão, GPS e cadência |
| Boa | >20 até 50 m | Dentro da meta; elegível a envio condicionado aos demais gates |
| Reduzida | >50 até 250 m | Alerta de qualidade reduzida; pode ser transmitida indicando precisão medida |
| Não confiável | >250 m | Mostrar aviso e **não enviar** ao backend |
| Indisponível | Sem permissão, amostra inválida ou >30 s | Mostrar medição indisponível; não reutilizar o último valor |

Os valores na interface são arredondados **para cima** a fim de não representar 250,1 m como 250 m. A precisão é a **estimativa horizontal informada pelo sistema operacional**, não uma garantia de erro máximo, distância até torre, qualidade de celular, nem confirmação de transmissão.

A API de posição da central (`teams.recordLocation`) já rejeita `accuracyMeters > 250` quando informado por clientes. O Mobile agora acompanha essa regra no próprio `GpsAttemptLedger`; o limite anterior de 500 m deixa de ser válido. A meta de 50 m é **preferencial**, não uma alteração silenciosa do limite operacional.

## Privacidade, autorização e ciclo de vida

- O usuário autoriza manualmente **Compartilhar localização**, e apenas com uma única ocorrência ativa atribuída, sessão e equipe validadas, app em primeiro plano e rede disponível.
- O monitor mostra **somente precisão e classificação**. Latitude, longitude e identificadores não são exibidos no indicador, armazenados nele ou enviados para telemetria.
- A localização fornecida pela API do aparelho alimenta o monitor. Uma amostra com qualidade inadequada não entra no ledger de tentativas de envio, preservando antirreplay e cadência de 20 segundos para amostras adequadas.
- A última precisão deixa de ser exibida 30 segundos depois da captura ou imediatamente após desligar o compartilhamento, revogar acesso ou suspender a sessão.
- O histórico de posições, gestão de consentimento e retenção da central continuam sujeitos aos contratos e gates já existentes; este incremento não implanta rastreamento em segundo plano.

## Torres, Wi-Fi e GPS: viabilidade técnica

- Em Android com serviços de localização compatíveis, o **Fused Location Provider** combina sinais de GPS/GNSS, redes Wi-Fi, celular e sensores. Em geral deve ser preferido a implementar triangulação de torres no aplicativo.
- O monitor de precisão **não mostra número de torres**, intensidade RSSI, localização específica de antena ou distância a uma torre. RSSI não é diretamente uma estimativa de erro horizontal em metros.
- O atual `@capacitor/geolocation` solicita `enableHighAccuracy:true`. A escolha concreta dos provedores é governada pelo sistema operacional/plugin; uma migração para a API nativa Fused/Google Play Services precisa ser validada separadamente no estágio Android nativo após resolver `ANDROID-AUTH`.
- Se o GPS estiver indisponível, a rede celular pode fornecer uma posição aproximada, que ainda deve passar pelos mesmos critérios de idade/qualidade. Triangulação por dados brutos da operadora exige contratos e autorização próprios.

Referências técnicas: [Google Fused Location Provider](https://developers.google.com/location-context/fused-location-provider) e [Android Location Updates](https://developer.android.com/develop/sensors-and-location/location/request-updates).

## SMS de contingência: estudo futuro, não implementado

**Não utilizar SMS oculto/invisível** para rastrear ou transmitir coordenadas sem transparência e autorização do agente: SMS não melhora precisão, só encaminha uma medição já existente. Mensagens SMS podem ter atrasos, custos, metadados e proteção inferior à de HTTPS autenticado; seu uso para dados de localização merece avaliação de segurança e privacidade.

**Android:** permissões de SMS são restritas pela política do Google Play; eventual integração precisa de verificação de elegibilidade e aprovação, preferivelmente acionada pelo usuário, sem contornar as políticas.

**iOS:** a API de composição de SMS exige a interface de revisão e envio pelo usuário; não há SMS silencioso arbitrário para apps comuns.

**Android ELS:** o sistema operacional pode enviar localização ao serviço de emergência, inclusive via data SMS, após uma chamada/SMS de emergência. É um mecanismo de emergência com parceiros autorizados, **não um atalho disponível a aplicativos comuns de despacho**.

**Alternativa recomendada:** canal HTTPS autenticado, fila segura apenas quando o protocolo de servidor de idempotência e retenção estiver homologado, e indicação clara de perda de conectividade. Uma opção de *SMS de emergência iniciado pelo usuário*, com destinatário institucional previamente validado, dados minimizados, confirmação visual e política LGPD documentada, pode ser avaliada numa fase futura; **não foi ativada**.

Referências: [Política Google Play SMS](https://support.google.com/googleplay/android-developer/answer/10208820), [Apple MessageUI](https://developer.apple.com/documentation/messageui/mfmessagecomposeviewcontroller), [Android Emergency Location Service](https://developers.google.com/android/els).

## Aceite técnico e lacunas

1. Validar limites 20 / 50 / 250 m, inclusive valores fracionários como 250,001 m, relógios e amostras antigas.
2. Executar regressões Mobile, 2.000 cenários, 10 milhões de verificações sintéticas, campanha 5B quando acionada e compilação/emuladores Android.
3. Testar em **aparelho real** com localização exata e aproximada, em área aberta, prédios, perda de rede e retorno do sinal, medindo consumo de bateria e consentimento.
4. Integrar a PWA com backend de homologação para validar o recebimento e o bloqueio de posições de baixa precisão.
5. Não alterar `docs/quality/mobile-release-gates.json` por CI verde. `ANDROID-AUTH`, `ANDROID-GPS`, `ANDROID-E2E` e `IOS-RELEASE` permanecem pendentes de evidência real.
