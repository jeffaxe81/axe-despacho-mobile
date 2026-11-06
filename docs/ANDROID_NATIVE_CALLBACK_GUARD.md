# AXE Despacho — proteção nativa de retorno OAuth, sem App Link habilitado

**Estágio:** laboratório de segurança Android, sem conexão de login operacional. Continuação das PRs mobile #17/#18 e backend #243–#247.

## Quatro frentes técnicas

| Frente | Código entregue | Bloqueio para campo |
| --- | --- | --- |
| Android | `AxeNativeCallbackGuard.java` valida uma resposta Authorization Code de callback HTTPS, vinculada a emissor, URL e tentativa nativa de uso único. Arquivo Java puro empacotado no APK via instalador Capacitor. | Nenhum `intent-filter` HTTPS, domínio de App Link ou `assetlinks.json` foi aprovado; `MainActivity` continua **sem tratamento do callback** |
| Segurança | Validação estrita de origem/caminho, estado (comparação constante), emissor `iss` obrigatório conforme RFC 9207, `code` com formato seguro, ausência de fragmentos e parâmetros duplicados, prazo máximo de 5 minutos, rejeição de retorno repetido | Navegador de sistema, prova de posse do dispositivo e troca de tokens com servidor auditado ainda não implementados |
| Integração | Continua `NATIVE_AUTH_PENDING` em todas as chamadas à central originadas da WebView; nenhum código OAuth ou token atravessa a interface JS/nativo | Credenciais do cliente, issuer, backend de autorização, URL pública da central e App Link verificado não definidos |
| QA | `AxeNativeCallbackGuardHarness.java` é compilado e executado no CI com Java 21; testes de URLs hostis, issuer/state incorretos, query duplicada, expiração e 32 callbacks concorrentes. Adicionalmente, testes TypeScript de fail-closed e verificação do APK | Testes instrumentados Android 14–16 e segurança do redirecionamento em dispositivo físico ainda pendentes |

## Fluxo futuro — ainda proibido no aplicativo

1. A central deverá expor endpoint de autorização, trocar código PKCE S256 e confirmar identidade/escopo em backend antes de emitir sessão limitada.
2. O Android deverá iniciar o fluxo pelo **navegador do sistema** e preparar `state` e `code_verifier` apenas em armazenamento nativo efêmero, antes de qualquer navegação.
3. Somente após existir domínio oficial, URL de retorno exata, certificado de assinatura e `assetlinks.json` válido será possível configurar o `intent-filter` de App Link HTTPS com `android:autoVerify="true"`.
4. No retorno, o futuro handler nativo poderá usar `AxeNativeCallbackGuard.validateAndConsume`: URL exata e HTTPS, único `code`, `state` e `iss`, validação de prazo e consumo de uso único **antes** de qualquer consulta a servidor.
5. O código recebido nunca deverá ser exportado à WebView. O `code_verifier` também deve permanecer no processo nativo; a troca com a central será feita em TLS por uma implementação auditada, sem redirecionamentos de credenciais.
6. O backend deverá validar dispositivo, usuário, organização, equipe, revogação e autorização de cada ação; o retorno por si só **não** cria sessão válida.
7. Tokens futuros devem ser protegidos no cofre Android Keystore; operações de campo e GPS só serão habilitados após testes reais e aprovação da segurança.

## Propriedades já automatizadas

- Os callbacks são delimitados a até 4096 caracteres; o emissor e o destino registrado não podem conter usuário/senha, porta explícita, fragmento ou query.
- Não aceita `localhost`, HTTP, divergência de host, caminhos codificados/normalizados, parâmetros extras/duplicados, nomes percent-encoded nem `+` na query.
- Um objeto de estado pendente é consumido **uma única vez**, mesmo se a tentativa for inválida. A concorrência de 32 threads não pode aceitar dois retornos.
- Erros de validação não contêm código OAuth, state nem URI sensível.
- O instalador Android desativa `android:allowBackup` do APK para não transportar dados cifrados e resumos locais para backup automático. Isso não substitui a configuração de `dataExtractionRules` e testes reais de restauração/dispositivo.
- O validador é apenas uma biblioteca Java pura, **não** um serviço OAuth, interceptador de Intent ou solicitação de rede.

## Testes executáveis

```sh
node scripts/android/test-native-callback.mjs
npm run check
npm test
npm run build
npm run android:debug
```

O workflow `Android APK (debug)` executa o harness real com JDK 21, verifica o projeto Android gerado e compila o APK debug com Gradle. A pipeline `Mobile quality` valida a aplicação web e os testes de segurança de regressão. O laboratório é incapaz de realizar login nativo operacional, sem implantação, senha, token ou GPS autenticado.

**Próxima frente autorizável:** definir issuer e domínio da central, política de autenticação OAuth, assinatura do APK/assetlinks, consentimento do agente e testes Android 14–16 em homologação. Nenhuma decisão de liberação de produção foi tomada.
