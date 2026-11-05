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

## Proteções adicionais de sincronização e sessão (04/11/2026)

Antes de considerar uma atualização de ocorrências como recente e liberar comandos/GPS, a PWA valida em runtime o contrato completo de cada página: total e limite de 50 itens, IDs únicos, formatos de status/prioridade, revisão de status e vínculo de **todas** as ocorrências à equipe autenticada. Um resultado inconsistente bloqueia ações; não é reaproveitado como atualização válida.

O encerramento remoto só é considerado confirmado quando `auth.logout` devolve explicitamente `success: true`. Uma resposta HTTP 200 sem confirmação não remove a trava local. Antes de reutilizar cookies de sessão ou aceitar login na PWA, um teste sem dados pessoais verifica se o navegador consegue gravar, ler e remover a trava de logout; armazenamento indisponível bloqueia a autenticação. Estes controles não habilitam autenticação operacional no APK Android.

Homologar com backend real, perda/reconexão de rede e aparelho físico antes de declarar a release pronta.

## Sessão revogada e diagnóstico de GPS — robustez do cliente

Quando a API devolve `UNAUTHORIZED`, `UNAUTHENTICATED`, `SESSION_EXPIRED`, `FORBIDDEN`, `PERMISSION_DENIED`, HTTP `401` ou `403`, a PWA bloqueia a operação, oculta imediatamente ocorrências, remove resumos temporários de ambos os armazenamentos e exige novo login. Isto vale para consultas e para o resultado de mutações. Falhas de rede ou timeout mantêm os comandos bloqueados até revalidação, sem afirmar que a autorização foi revogada nem repetir escritos automaticamente. O transporte mantém os códigos HTTP 401/403 mesmo com corpo vazio, malformado ou com código tRPC divergente.

No APK Android de laboratório, o painel distingue **aguardando fix**, **captura recente** e **captura atrasada**; a classificação é baseada somente no timestamp volátil do serviço, nunca na latitude/longitude. Posições antigas não substituem timestamps mais recentes. O laboratório continua sem credenciais, API e transmissão de GPS.

**Não há liberação para produção:** a autenticação nativa segura e o serviço GPS operacional continuam dependentes das issues #4 e #5 e de homologação em dispositivo físico e central real.

## Validação de ocorrências ativas fora da primeira página

Uma consulta sem filtro retorna até 50 ocorrências. Não é seguro concluir que não existe outra ocorrência ativa somente porque ela não aparece nessa primeira página, que pode conter registros antigos ou finalizados. Para evitar autorizar comandos e GPS com uma contagem incompleta, o cliente agora faz, na mesma atualização de primeiro plano, quatro consultas autenticadas no escopo da organização: primeira página geral e contagens filtradas pelos status `aceita`, `em_atendimento` e `pausada`.

As quatro respostas são validadas pelo mesmo ID de equipe; status filtrados devem coincidir com o filtro, identificadores ativos não podem se repetir, versões do mesmo incidente devem ser consistentes e as páginas de 50 precisam respeitar a contagem total. Se uma ocorrência ativa não estiver na página geral, ela aparece no topo da lista do agente. Se a contagem global indicar duas ou mais ocorrências ativas, GPS e mutações são bloqueados. Qualquer falha ou inconsistência entre consultas bloqueia os comandos até revalidação.

**Limitação importante:** respostas de consultas paralelas não são uma fotografia transacional da base. As verificações eliminam inconsistências observáveis, mas a confirmação atômica de versões/contagens dependerá de contrato específico no backend. O APK nativo continua em modo laboratório até autenticação segura e homologação com a central.

### Verificação de coerência das quatro consultas de ocorrência

O cliente agora rejeita um conjunto de respostas em que a soma de ocorrências ativas seja maior que o total declarado da equipe. Quando a consulta geral contém **todas** as ocorrências (até 50), cada item ativo dos filtros precisa estar presente nessa mesma página. Uma ocorrência filtrada mas ausente da lista completa é sinalizada como `INCONSISTENT_TEAM_SNAPSHOT`, sem habilitar comandos ou GPS. Também são detectadas diferenças de código, prioridade, categoria, endereço e descrição entre as consultas de um mesmo incidente, além do estado e da revisão já validados.

Este endurecimento detecta contradições de contagem e conteúdo, mas **não transforma consultas paralelas em uma transação atômica**. A autorização operacional definitiva continua no servidor; a autenticação nativa e os testes reais de campo continuam pendentes.


## Proteções adicionais de transporte e sessão (05/11/2026)

As requisições autenticadas da PWA exigem HTTPS. HTTP é admitido somente no loopback local (`localhost`, `127.0.0.1`, `[::1]`) para desenvolvimento; não são permitidos HTTP em LAN, domínios remotos ou `file://`. A API opera na mesma origem, com `redirect: "error"`, evitando o encaminhamento automático do corpo de logins e mutações por redirects 307/308. Veja [Política de transporte](docs/SEGURANCA_TRANSPORTE.md).

Qualquer marcador presente na chave local de logout pendente, inclusive valores corrompidos ou vazios, impede reaproveitar o cookie da sessão; o evento de outra aba também revoga os dados operacionais no cliente. O Vite está restrito a `127.0.0.1`, e seu proxy de desenvolvimento permite apenas alvos explícitos de loopback sem credenciais nem caminhos extras, mantendo verificação TLS ativa para HTTPS. Veja [Segurança de sessão e desenvolvimento](docs/SEGURANCA_SESSAO_DESENVOLVIMENTO.md).

**Escopo:** endurecimento do cliente e do ambiente de desenvolvimento, não autenticação nativa, não implantação em produção e não liberação de rastreamento GPS operacional. As issues #4/#5, a auditoria de cookies/CSRF na central e a homologação em dispositivos físicos continuam pendentes.

## Ciclo de seis frentes — isolamento de sessão e preparação Android

O cliente utiliza agora um **ticket de sessão volátil** que impede respostas antigas de autenticação, consultas de ocorrências e mutações de restabelecerem dados após logout, revogação ou troca de organização. As consultas e o GPS permanecem dependentes das autorizações reais da central; a autenticação nativa Android continua bloqueada até existir contrato específico no backend. Foram incluídos testes de corrida assíncrona e uma bateria que tenta executar todas as operações autenticadas na WebView nativa, confirmando que nenhuma chega à rede.

Consulte [plano técnico das seis especialidades e contrato nativo proposto](docs/SEIS_FRENTES_SESSAO_NATIVA.md) para o que foi implementado, os testes e os riscos que ainda impedem a homologação.
