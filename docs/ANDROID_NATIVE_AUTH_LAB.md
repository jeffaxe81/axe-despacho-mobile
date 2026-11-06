# AXE Despacho — PKCE e Android Keystore (laboratório, sem login)

**Status:** preparação técnica do APK debug, sem autorização operacional. Repositório móvel `jeffaxe81/axe-despacho-mobile`, backend `jeffaxe81/dispatch` (contratos PKCE e tabelas homologadas somente no MySQL efêmero do CI).

## Quatro frentes de revisão técnica

| Frente | Implementado neste ciclo | Ainda necessário |
| --- | --- | --- |
| Android | `AxeNativeAuthLabPlugin.java` cria um `code_verifier` nativo aleatório e desafio PKCE S256, mantendo o verificador **apenas na memória Java**; tela `AndroidAuthLab.tsx` exibe estado e permite limpar o laboratório | App Link HTTPS oficial, navegador do sistema, callback seguro, autenticação em dispositivo físico |
| Segurança | `AxeNativeSessionVault.java` prepara criptografia AES-256-GCM com chave do **Android Keystore** e bytes cifrados em armazenamento privado, sem API JS de leitura/gravação. `AxeNativeAuthPolicy.java` mantém o login operacional explicitamente em `false` | Integração do cofre com um fluxo nativo de troca de tokens auditado, rotação/expiração, binding criptográfico e revogação |
| Integração | Nenhuma rota tRPC, cookie, política CORS ou regra de sessão foi relaxada; `api.ts` continua retornando `NATIVE_AUTH_PENDING` antes de uma chamada autenticada no Android | Endpoint OAuth/Authorization Code PKCE aprovado na central, issuer/redirect URI e consentimento |
| QA | Testes `nativeAuthLab.security.test.ts` validam a fronteira JS/nativo e as proteções de configuração; `android:verify` exige classes registradas, proíbe login habilitado e impede App Link fictício; CI gera APK debug | Instrumentação Android 14–16 real, pentest, fluxo de reautenticação e integração com central de homologação |

## Protocolo de teste local

1. Instalar o APK **debug** e abrir `Autenticação Android · laboratório`.
2. Tocar em **Gerar desafio PKCE de teste**. A biblioteca Android usa `SecureRandom` para gerar um verificador de 256 bits, codificado em Base64url; o desafio é SHA-256 Base64url e um `state` separado é gerado.
3. O verificador nunca é retornado ao JavaScript do WebView, nem escrito em `localStorage`, logs ou banco. O desafio expira em cinco minutos e é eliminado no encerramento do plugin/aplicativo, ou ao tocar em **Limpar laboratório**.
4. O cofre Android Keystore está **preparado, mas não armazena sessão operacional**. Não há método de plugin que receba senha ou token da WebView e escreva no cofre; ele só poderá ser utilizado futuramente pelo fluxo nativo auditado.
5. Não há abertura de navegador, registro de App Link nem troca de código por token. O backend não disponibiliza neste ciclo novos endpoints de autenticação.
6. A tela continua mostrando login nativo bloqueado e não altera a sessão web ou o modo GPS de laboratório.

## Critérios de segurança para habilitar futuramente

- A central deve disponibilizar Authorization Code + PKCE S256 no navegador de sistema, com origem, emissor e cliente registrados, redirecionamento por App Link HTTPS verificado via `assetlinks.json` no domínio oficial e assinatura de pacote autorizada.
- O Android deve validar estado, emissor e redirect URI antes de trocar o código. O verificador e o token devem permanecer **exclusivamente no canal nativo**, nunca exportados para JS. Um callback deve ser consumido uma vez, sujeito a prazo e revalidação.
- O backend deve vincular sessão, usuário, equipe, organização e dispositivo, conferindo revogação e permissões atuais nas mutações. Os serviços `mobile_auth_*` ainda estão desligados das rotas operacionais.
- A autenticação não autoriza GPS por si só. Rastreio com tela bloqueada exige consentimento, retenção LGPD e homologação separada da issue #5.
- O APK publicado não pode trazer `OPERATIONAL_LOGIN_ENABLED=true`, URL do servidor em código legado, CORS liberado ou cookies cross-site como atalho.

## Testes

```sh
npm run check
npm test
npm run build
npm run android:debug
```

O workflow Android gera somente pacote de depuração. Os testes estáticos de segurança e o build Gradle verificam contratos e compilação; **não comprovam segurança criptográfica em aparelho físico nem disponibilidade da central**. Não instalar em operação de campo.
