# AXE Despacho Mobile — smoke em emuladores Android 14, 15 e 16

**Escopo:** instalação e comportamento defensivo do APK de laboratório gerado pelo workflow `Android APK (debug)`. Esta etapa complementa os 10 milhões de cenários sintéticos sem substituí-los.

## Evidências de execução

O workflow da PR contém três jobs independentes de emulação Android em `reactivecircus/android-emulator-runner@v2`, para API 34 (Android 14), 35 (Android 15) e 36 (Android 16). Cada job reutiliza **o mesmo APK debug previamente compilado**; a ferramenta não entrega um aplicativo de produção.

O script `scripts/android/emulator-smoke.sh` valida:

1. Instalação efetiva e existência do pacote `com.axesistemas.axedespacho`.
2. Natureza **debug-only** do APK (via `run-as`).
3. Ausência de solicitação de `ACCESS_BACKGROUND_LOCATION` no pacote.
4. Negação explícita das permissões de localização para iniciar em condição segura.
5. Inicialização a frio da `MainActivity`, com processo ativo.
6. Retorno após ir à tela inicial do Android.
7. Retorno após bloquear e desbloquear a tela.
8. Reabertura após encerramento forçado, sem travamento na inicialização.
9. Não inicialização automática do serviço GPS de laboratório sem consentimento.
10. Captura de tela de dispositivo **emulado** e recibo JSON com API testada e indicador `production_approved:false`.

Cada job publica como artefato uma captura de tela do emulador, pequenos logs de inicialização e recibo de execução. O resultado só é considerado sucesso quando todas as versões completam os testes. Se o emulador não iniciar, o APK não instalar, a Activity não abrir ou o serviço GPS for ativado indevidamente, o CI falha.

## Limites obrigatórios

- **Emulador não é telefone físico:** não valida consumo de bateria, precisão real do GPS, permissões alteradas pelo fabricante, geolocalização com tela bloqueada em operação nem comportamento do modem/rede móvel.
- **Não existe autenticação nativa de produção:** o código mantém `NATIVE_AUTH_PENDING`, sem abrir App Link/OIDC, registrar credenciais reais ou fazer login com a central.
- **Não existe GPS operacional em segundo plano:** `AxeLocationLabService` continua debug-only e não registra ou envia coordenadas à central.
- Não altera os gates de `docs/quality/mobile-release-gates.json` e não aprova produção.

**Próximas evidências reais:** Android físico 14–16, autenticação PKCE/Keystore com central de homologação, autorização multi-tenant, GPS com foreground service e a tela bloqueada, avaliação de permissões, bateria, recuperação de rede e relatório de aceite com responsável/data/link. Os testes iOS são uma fase posterior.
