# Integração com a central AXE Despacho

## Fonte de verdade e escopo

A API HTTP/tRPC e o MySQL ficam exclusivamente em `jeffaxe81/dispatch`. Este frontend consome os contratos existentes por HTTPS, sem credenciais de banco, cópia de servidor ou atalho de autorização.

| Operação | Procedimento da central | Regra |
| --- | --- | --- |
| Sessão | auth.me / auth.login / auth.logout | cookie HTTP-only e TLS |
| Organizações | tenant.selection | seleção validada; x-organization-id somente escopo autorizado |
| Permissões | access.me | agente ativo, vinculado a equipe, permissões de consulta/transição |
| Ocorrências | incidents.list | somente atribuídas ao agente e ao tenant |
| Aceitar/recusar | incidents.respondToAssignment | API confirma equipe/atribuicão; nunca executar offline |
| Mudança de estado | incidents.transition | status esperado, revisão quando disponível e justificativa |
| Localização | teams.recordLocation | agente e equipe próprios, tenant validado, opt-in explícito |

## Política da sessão atual

A central usa `credentials: include`, `auth.me` e cookie HTTP-only. Isso funciona quando o mobile é servido na **mesma origem HTTPS** da central (exemplo: sob `/mobile` com proxy de API na mesma origem) ou no desenvolvimento local com proxy Vite.

No projeto Capacitor, o código web é servido de uma origem nativa (como `capacitor://localhost`). O login da central não tem, ainda, um fluxo de autenticação móvel dedicado. Não usar `server.url` remoto em produção para contornar isso, não relaxar `SameSite`, não aceitar tokens persistidos em `localStorage` e não abrir CORS irrestrito. O cliente bloqueia configuração de API em origem diferente do WebView: falha fechada.

**Integração nativa pendente na central:** desenhar autorização de dispositivo, PKCE/refresh ou sessão mediada por canal nativo seguro, revogação, rate limit, vínculo de equipe/tenant e testes com Android/iOS reais. Somente então habilitar mutações em builds nativos.

## Invariantes

1. Sem replay automático de aceite, recusa, conclusão, mudança de status, geolocalização ou anexos enquanto offline.
2. Permissões e revisões são confirmadas no servidor a cada ação.
3. Após perda de rede, revalidar atribuições antes de liberar comandos.
4. Não armazenar coordenadas, endereço, descrição, senha ou anexos em cache web persistente.
5. Aplicativos de campo não ficam associados à central até obter consentimento do agente e confirmar a sessão.

Contrato de validação: manter testes de integração no backend e neste cliente antes de liberar APK.
