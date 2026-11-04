# AXE Despacho Mobile

Cliente mobile independente do [AXE Despacho — central web e backend](https://github.com/jeffaxe81/dispatch).

## Objetivo

Agentes em campo usam celulares e tablets Android/iOS para consultar ocorrências atribuídas, aceitar despachos e registrar o atendimento, com compartilhamento GPS **iniciado pelo usuário e autorizado pela central**.

**Este projeto NÃO é AXE PABX, AXE Voice ou CRM.** Não contém banco de dados, servidor de despacho nem API própria. A central `jeffaxe81/dispatch` continua sendo a fonte de verdade.

## Escopo deste ciclo

- Frontend React/Vite leve e responsivo para agentes Android, iOS e tablets.
- Capacitor 8 configurado para criar projetos nativos posteriormente.
- Contratos de consumo do backend existente por tRPC HTTP + SuperJSON.
- Login com cookie HTTP-only existente **somente em implantação web de mesma origem**.
- Validação de perfil, permissões e organização ativa, consulta a ocorrências, aceite/recusa e transição com checagem de status.
- GPS **somente enquanto o aplicativo estiver ativo**, mediante opt-in; sem persistir ou reproduzir posições automaticamente.
- Resumo redigido de ocorrências salvo opcionalmente no navegador por no máximo 15 minutos, isolado por usuário/empresa/equipe, com limpeza ao sair.
- Testes unitários e workflow de verificação de build.

**Ainda NÃO é APK/IPA homologado, não contém GPS contínuo em segundo plano, notificação push nem autenticação nativa em origem diferente da central.**

## Executar localmente

Requisitos: Node.js 24 ou superior e npm.

~~~bash
npm install
cp .env.example .env.local
# Ajuste VITE_DISPATCH_DEV_PROXY para o servidor de desenvolvimento da central
npm run dev
npm run check
npm test
npm run build
~~~

A central deve estar disponível na origem configurada no proxy. O navegador se comunica com `/api/trpc` no **mesmo host/porta do frontend**, e o Vite encaminha as requisições ao backend de desenvolvimento. O frontend nunca acessa MySQL diretamente.

## Android e iOS

~~~bash
npm install
npx cap add android
npx cap add ios
npm run native:sync
~~~

Android requer Android Studio e SDK. iOS requer macOS/Xcode. Os diretórios nativos gerados por `cap add` devem ser versionados somente após validação das permissões/manifestos e da autenticação nativa. **Não distribuir um APK ainda:** a autenticação atual da central usa cookies `SameSite`, e uma WebView Capacitor possui origem diferente. Um contrato de autenticação nativa revisado é requisito de homologação.

Consulte [Integração com a central](docs/INTEGRACAO_CENTRAL.md), [GPS nativo e persistência](docs/GPS_E_PERSISTENCIA.md) e [Roadmap de homologação](docs/ROADMAP.md).

## Origem

Base funcional extraída conceitualmente da branch `feat/axe-despacho-mobile-lite` do repositório da central e dos contratos tRPC do AXE Despacho. As duas soluções terão evolução e CI independentes.

## Android primeiro — build debug

O projeto Android é **gerado temporariamente no CI** a partir do Capacitor 8 (SDK 36, JDK 21). O workflow [Android APK (debug)](.github/workflows/android-debug.yml) compila o bundle web, executa os testes e cria um APK de depuração para teste visual/instalação. A configuração nativa ainda não está versionada, pois não há serviço GPS nativo aprovado nesta etapa.

1. Acesse a aba **Actions** > **Android APK (debug)** e abra uma execução concluída.
2. Na seção **Artifacts**, baixe `axe-despacho-android-debug`.
3. Use o APK **somente em laboratório**: login nativo está desabilitado até existir autenticação segura da central. Nunca envie credenciais para uma WebView sem contrato validado.

Para gerar no computador com Android SDK e Java 21: `npm run android:debug`. O Android 8 do Capacitor usa API 36 e Gradle; após criar o projeto pela primeira vez, ajuste o fluxo para `cap sync android` nas builds seguintes. **Não é uma release assinada para produção**.

O aplicativo interrompe o compartilhamento GPS ao perder rede ou ser colocado em segundo plano; ao voltar, exige consulta atualizada à central antes de liberar operações. O limite de precisão enviado atualmente é de 500 metros (pontos piores são descartados), sujeito a homologação de campo.

## Android: atividade em segundo plano e Git público

O plugin oficial `@capacitor/app` sinaliza `appStateChange` na atividade Android, complementando `visibilitychange` do navegador. Ao colocar a atividade em segundo plano, o aplicativo suspende o compartilhamento GPS e exige revalidação antes de novos comandos; ao retornar não liga o GPS sozinho. **Isso NÃO equivale a um serviço de rastreamento em background.**

O Git permanece público. O workflow executa `scripts/public-repo-guard.mjs` e recusa arquivos rastreados com certificados, keystores, perfis de provisionamento e `.env` com credenciais. Continue utilizando repositório de segredos do CI, nunca arquivos versionados. Esta verificação não substitui revisão de código, scanners de tokens e política de LGPD.

## GPS com a tela bloqueada — laboratório Android

O APK de debug gera agora um **Foreground Service Android** de laboratório com notificação persistente e ação `Encerrar teste GPS`. Ele pode continuar recebendo atualizações de GPS enquanto a tela estiver bloqueada, quando o sistema e as permissões permitirem. O laboratório armazena apenas **um horário de captura em memória volátil**, não grava ou envia latitude/longitude e não realiza ações no servidor. O serviço é ativado somente no aplicativo Android de depuração mediante confirmação explícita e permissão de localização.

O serviço fica em `native/android/AxeLocationLabService.java`, o bridge em `AxeLocationLabPlugin.java` e é instalado em projeto Capacitor gerado via `npm run android:install-lab`. Os arquivos são de código público e não contêm certificados ou segredos.

**Importante:** isto não é a funcionalidade de rastreamento operacional. Não sincroniza com mapa da central, não substitui a integração de login nativo da [issue #4](https://github.com/jeffaxe81/axe-despacho-mobile/issues/4) ou o serviço autenticado em campo da [issue #5](https://github.com/jeffaxe81/axe-despacho-mobile/issues/5). Não utilizar em atendimentos reais.

## Aprimoramentos do cliente Android e PWA

**APK Android de demonstração:** `AndroidFieldDemo` permite experimentar a interface de atendimento com três ocorrências fictícias identificadas por `DEMO-...`, sem rede, login, persistência ou gravação na central. Aceitar, iniciar, pausar, retomar, concluir ou recusar são **transições exclusivamente locais na memória**; reiniciar apaga o histórico demonstrativo. O modo “simular ausência de conexão” bloqueia os botões de ação. O rastreio real de campo continua desabilitado no APK até a implementação da autenticação nativa.

**PWA autenticada de mesma origem:** quando aberta, conectada e com usuário/equipe autorizados, consulta `incidents.list` a cada 15 segundos. Uma leitura não pode permanecer válida por mais de 45 segundos; em falha de rede, suspensão do app ou perda de autorização, aceite, transição e envio de GPS ficam bloqueados. As consultas antigas são canceladas ao mudar de equipe/organização. A aplicação valida se todas as ocorrências retornadas pertencem à equipe autorizada, e não permite replay automático de mutações após perda de conexão.

A API usa `AbortController` e timeout de consulta (12s) ou mutação (20s), sem retry de escrita, pois o resultado de uma mutação interrompida pode ter sido aplicado na central. Em caso de resultado incerto, conferir o servidor antes de repetir o comando. Novos testes cobrem escopo, validade temporal, cancelamento, falha de rede e estado demonstrativo.

**Limites:** o cliente apresenta até 50 ocorrências por consulta e avisa se existirem mais. No modo Android nativo de laboratório não se apresentam dados reais e não se realiza autenticação nem escrita no servidor.

## Encerramento remoto resiliente

Se o agente solicitar **Sair**, o navegador grava primeiro um marcador local de *logout pendente*, que não contém senha, cookie, token ou identificador pessoal. A aplicação então tenta encerrar a sessão na central. Se a requisição falhar (por exemplo, perda de sinal), **não volta a usar o cookie da sessão**: a tela bloqueia as operações e oferece o botão `Confirmar saída na central`. O marcador persiste após fechar e reabrir o navegador e notifica outras abas na mesma origem por `storage`. Somente a confirmação HTTPS de `auth.logout` apaga a trava.

O marcador é separado dos resumos offline e não é removido pela limpeza normal desses resumos, pois a segurança da sessão tem precedência sobre a experiência offline. Se o dispositivo não permitir ler/gravar o marcador, a operação falha fechada e exige confirmação junto à central. A versão Android nativa segue sem autenticação operacional nesta fase.
