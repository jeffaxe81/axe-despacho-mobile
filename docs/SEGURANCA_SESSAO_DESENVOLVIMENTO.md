# Segurança de sessão e ambiente de desenvolvimento — 05/11/2026

## Correções em revisão

1. **Logout pendente falha fechado:** qualquer valor presente na chave `dispatch.mobile.pendingLogout.v1`, inclusive valores vazios, corrompidos ou inesperados, significa sessão bloqueada. Somente a ausência comprovada da chave permite uma sessão. A limpeza só acontece após confirmação do logout pela central.
2. **Propagação entre abas:** eventos de armazenamento que introduzam qualquer marcador não nulo devem revogar a UI operacional e limpar os dados temporários da aba atual. A remoção da chave por outra aba não reativa a sessão automaticamente.
3. **Vite local apenas:** o comando `npm run dev` e a configuração do servidor vinculam a interface a `127.0.0.1`, evitando expor a origem de autenticação em uma LAN sem criptografia.
4. **Proxy controlado:** `VITE_DISPATCH_DEV_PROXY` aceita apenas URLs HTTP(S) sem usuário/senha, caminho adicional ou query, com hostname exato `localhost`, `127.0.0.1` ou `[::1]`. Alvos externos, IPs privados da LAN e DNS similares a localhost são rejeitados antes de subir o servidor. A validação TLS do proxy HTTPS permanece ativa (`secure: true`).

## Verificação obrigatória

- Executar `npm run check`, `npm test` e `npm run build`.
- Revisar resultados de `Mobile quality` e `Android APK (debug)` no mesmo head SHA do PR.
- Testar: valor corrompido do marcador, remoção de armazenamento que falha, múltiplas abas, acesso LAN negado, proxy localhost permitido, URLs remotas rejeitadas.
- Comprovar que a PWA usa a mesma origem HTTPS da central quando implantada; não usar o proxy Vite como configuração de produção.

## Limites

Este ajuste não altera o contrato de sessão da central, não implementa autenticação nativa, não permite envio GPS operacional e **não autoriza produção**. Continuam pendentes revisão de CSRF/cookies do backend, homologação com central real, testes Android 14–16 e as issues #4 e #5. O PR de transporte seguro #13 é independente e também não altera a produção.
