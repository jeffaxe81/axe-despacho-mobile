# AXE Despacho Mobile — evolução GPS com preparação para IA

**Ciclo:** 08/11/2026 · **Escopo da entrega:** somente software, documentação e CI sintética. **Sem produção.**

## Propósito

Acompanhar a qualidade da posição híbrida estimada pelo dispositivo (GNSS, Wi-Fi e rede celular quando disponíveis), identificar a **tendência** das últimas leituras e sugerir cuidados operacionais. A camada proposta **não cria coordenadas de localização**: somente avalia o erro horizontal que o sistema operacional reporta.

## Entregas de desenvolvimento incluídas no percentual

| Frente | Código / evidência | Aceite de desenvolvimento |
|---|---|---|
| GPS-AI-01 | `gpsPrecision.ts`, `gpsAttemptLedger.ts` | Faixas 20/50/250 m, bloqueio acima de 250 m e validade temporal |
| GPS-AI-02 | `gpsQualityIntelligence.ts` | Mediana, tendência, oscilação e histórico de **até 12 amostras** em memória |
| GPS-AI-03 | `GpsPrecisionMonitor.tsx`, `GpsQualityAssistant.tsx` | Qualidade, tendência e sugestões visíveis no painel do agente |
| GPS-AI-04 | `GpsAiBackendProvider`, `toGpsAiFeatures` | Contrato de IA de terceiro: parâmetros **sem coordenadas**, instruções permitidas por enum, sem chamada habilitada |
| GPS-AI-05 | `gpsPrecision.test.tsx`, `gpsQualityIntelligence.test.tsx` e suítes existentes | CI qualidade, políticas, testes sintéticos e regressão antirreplay |
| GPS-AI-06 | Documentação e escopo de percentuais | Entrega distinta de homologação, sem mudar o bloqueio de produção |

**Critério para declarar "100% de desenvolvimento do incremento":** as seis frentes implementadas, testes de desenvolvimento aplicáveis aprovados e código integrado à `main`. Uma PR aberta ou CI falhando não significa 100%, mesmo que o código esteja escrito. O percentual deve ser calculado apenas sobre essas seis frentes, não sobre a conclusão de todo o AXE Despacho.

**Itens reais retirados do denominador da entrega de desenvolvimento:** `ANDROID-AUTH`, `ANDROID-GPS`, `ANDROID-E2E`, `IOS-RELEASE`; ensaios em campo de GNSS/celular/Wi-Fi; validação de rede, bateria, dispositivos e servidor de homologação. Eles serão acompanhados em **indicador separado**, não reduzindo o percentual de desenvolvimento. **Continuam obrigatórios antes de produção**.

## Assistência inteligente versus modelo de IA

A presente versão usa **inferência estatística determinística**, não um modelo neural ou LLM:
- Guarda somente `accuracyMeters` e `capturedAt`, sem latitude, longitude, IMEI, torres, Wi-Fi BSSID, credenciais, nomes ou identificação do agente.
- Descarta leituras inválidas, duplicadas, fora de ordem e antigas; retém no máximo 12 valores voláteis, limpando quando o compartilhamento é desativado.
- Calcula mediana e evolução da qualidade entre as três primeiras e as três últimas amostras. Não estima a posição geográfica nem afirma previsão de erro garantida.
- Quando a precisão oscila, aconselha aguardar; quando piora ou ultrapassa 250 m, sugere procurar área aberta, se for seguro.
- Jamais altera `validLocation`, `GpsAttemptLedger`, permissões de sessão/equipe ou regras do servidor com base em sugestões.

A interface indica **"Análise local · sem IA externa conectada"**. O contrato `GpsAiBackendProvider` permite **uma futura conexão à IA do cliente via backend**. Para ativá-la serão necessários autenticação, aceite explícito, endpoint HTTPS do servidor, cotas, auditoria, teste de segurança e política de dados. O navegador não receberá a chave de API do provedor.

A futura IA só poderá sugerir um dos comandos **`wait`, `open_area`, `precise_permission` ou `check_sky_view`**. Texto livre não poderá alterar uma posição ou determinar seu envio. O parser recusa comandos imprevistos, dados adicionais e ações como `send_sms` ou `ignore_250m`.

## Possibilidades de IA — próximas versões (não entregues neste ciclo)

1. **Modelo do cliente para qualidade de sinal:** previsão de degradação usando apenas atributos aprovados e não identificadores de rede; calibrar com dados sintéticos e depois validar em campo, sem promessa de erro <50 m.
2. **Detecção de comportamento atípico:** sugestões ao operador quando o sinal oscilar ou a trajetória parecer inconsistente; comparação de coordenadas somente sob consentimento e controle de retenção.
3. **Correlacionar contexto operacional:** alertas sem revelar dados sensíveis a fornecedores externos; provar isolamento multi-tenant e governança.
4. **Integração celular/GNSS nativa:** utilizar os provedores híbridos Android via APIs autorizadas, sem falsa triangulação por RSSI.
5. **SMS de contingência:** avaliação isolada, opt-in visível, somente transporte, nunca precisão adicional; nenhum SMS oculto.

## Lacunas / bloqueios

- **CI Android:** o Gradle 8.14.3 tem retornado HTTP 504 no redirecionamento do download da distribuição; o job APK/emuladores precisa passar antes do merge, ou o bloqueio deverá ser registrado. Não falsificar sucesso.
- **Integração com IA externa:** interface de contrato criada, provedor não instalado nem chamado.
- **Dados de posição:** SDK, permissões e comportamento em segundo plano dependem de teste físico real, **excluído do cálculo de desenvolvimento**, mas ainda pendente de operação.
- **Produção:** `docs/quality/mobile-release-gates.json` permanece `NOT_APPROVED_FOR_PRODUCTION`, sem alteração.

Referências: `docs/quality/GPS_PRECISAO_HIBRIDA_SMS.md` e as evidências de Actions da PR GPS.
