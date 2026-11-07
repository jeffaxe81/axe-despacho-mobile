# AXE Despacho Mobile — teste imediato da main

**Versão de pré-homologação:** o APK compilado é **DEBUG/LABORATÓRIO**, não um aplicativo operacional de campo. A API da central depende de [jeffaxe81/dispatch](https://github.com/jeffaxe81/dispatch). Nenhum destes passos requer ou autoriza ambiente real, produção, token de terceiros ou dados de cidadãos.

## A. Baixar o APK de laboratório
1. Abrir [Android APK (debug) no GitHub Actions](https://github.com/jeffaxe81/axe-despacho-mobile/actions/workflows/android-debug.yml) e filtrar **Branch: main**.
2. Selecionar execução com **Success** (e o SHA que se deseja avaliar).
3. Em **Artifacts**, baixar o arquivo **axe-despacho-android-debug**; o artefato expira após **7 dias**.
4. Descompactar e instalar `app-debug.apk` apenas no dispositivo/emulador de testes autorizado. Não usar contas reais e não habilitar localização operacional para a central.
5. Registrar SHA, modelo/API Android, horário UTC e evidência visual redigida.

## B. O que validar no Android debug
- [ ] Instalação e abertura sem crash, navegação, Voltar, plano de fundo/primeiro plano e rotação.
- [ ] Layout compacto, campos e mensagens sem sobreposição nem rolagem lateral indevida.
- [ ] Login nativo continua bloqueado; não exibe cookies, tokens ou senha.
- [ ] Simulador de ocorrências claramente fictícias (`DEMO-`), sem ligação ao backend.
- [ ] Permissões e serviço GPS em laboratório: notificação visível, início/parada controlados. Nenhum upload remoto autenticado.
- [ ] Perda/retorno de rede, GPS indisponível, permissões negadas e tela bloqueada: coletar apenas evidência de comportamento de laboratório.
- [ ] Verificar se logs de testes não contêm segredos nem coordenadas pessoais.

O workflow também oferece **emuladores Android API 34, 35 e 36**, quando executados com sucesso. Evidência de emulador **não substitui** ensaio físico de Android 14–16.

## C. Testar PWA local com backend de desenvolvimento
```bash
git clone https://github.com/jeffaxe81/axe-despacho-mobile.git
cd axe-despacho-mobile
npm install
npm run check
npm test
npm run test:readiness
npm run readiness:mobile
node --test scripts/quality/phase-handoff-audit.nodecheck.mjs
npm run build
```
Subir primeiro a central Web em ambiente **local e isolado**, usando dados sintéticos. Criar `.env.local` a partir de `.env.example` e manter o proxy `VITE_DISPATCH_DEV_PROXY=http://127.0.0.1:3000` somente se o backend local estiver nessa porta. Executar `npm run dev` no mesmo computador e abrir `http://127.0.0.1:5175`. Não conectar Vite por túnel ou abrir `--host 0.0.0.0`: a autenticação existente é baseada em cookies same-origin.

## D. Testes de aceitação da PWA
- [ ] Sessão ativa/inativa, logout confirmado e logout não confirmado após falha de rede.
- [ ] Limpeza de `localStorage` de outra aba invalida imediatamente acesso local e exige revalidação.
- [ ] Usuário sem permissão ou organização diferente não recebe dados e não envia comandos.
- [ ] Lista de ocorrências fictícias, alteração de status, retorno da rede e atualização de atribuição.
- [ ] Cache opt-in não registra endereço, nome, descrição, telefone, localização, tokens ou anexos; expira em 15 minutos.
- [ ] Telas 320/375/768/1024 px, teclado, foco, mensagens de erro e indicadores de carregamento.
- [ ] GPS no navegador só com permissão do usuário; idade/precisão invalidam pontos ruins, sem retransmitir localização após timeout ambíguo.
- [ ] `readiness:mobile` retorna 0/4 enquanto homologação real permanecer pendente, mesmo com CI verde.

## E. Relatar resultados
Cada cenário recebe `PASS`, `FAIL` ou `BLOCKED`, acompanhado de **commit SHA**, versão do Android/navegador, data UTC, responsável e link seguro de artefato. Em falha, abrir issue com passos para reprodução **sem dados pessoais**.

**Bloqueios P0 de campo:** [autenticação nativa #4](https://github.com/jeffaxe81/axe-despacho-mobile/issues/4), [GPS em background #5](https://github.com/jeffaxe81/axe-despacho-mobile/issues/5), homologação real e revisão independente. **Produção: NO-GO**.
