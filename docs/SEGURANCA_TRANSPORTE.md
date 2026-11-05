# Proteção de transporte da API — pré-produção (05/11/2026)

## Política no cliente

- A PWA com autenticação por cookie HttpOnly usa exclusivamente a origem do frontend para `/api/trpc/*`; a variável `VITE_DISPATCH_API_BASE` não permite desviar a API para outra origem.
- Chamadas autenticadas exigem **HTTPS**. Exceção estrita para desenvolvimento local via `http://localhost`, `http://127.0.0.1` ou `http://[::1]`. Acesso HTTP por IP privado/LAN ou domínio remoto é recusado **antes** da execução de `fetch` com o código `INSECURE_TRANSPORT`.
- Todas as chamadas `fetch` utilizam `redirect: "error"`. Um redirecionamento HTTP não é seguido: isso evita o reenvio automático de senhas e corpos POST em redirects 307/308 para outro servidor. Uma falha desse tipo é tratada como falha de rede, sem repetição automática de mutações.
- O bloqueio `NATIVE_AUTH_PENDING` permanece para Capacitor Android/iOS, inclusive no laboratório; não foi adicionado token, cookie cross-origin ou bypass de CORS.

## Testes automatizados

O arquivo `src/lib/api.transport.test.ts` cobre origens HTTP remotas e LAN, a exceção loopback, `redirect: "error"` em login e a ausência de repetição após rejeição da requisição. Execute `npm run check && npm test && npm run build` e os pipelines do GitHub Actions.

## Riscos e pendências antes de produção

Esta medida **não substitui** TLS/HSTS adequadamente configurados na central, validação de origem/CSRF no backend, autenticação nativa com armazenamento seguro, revisão de cookies `Secure`/`SameSite`, auditoria, testes em dispositivos físicos e homologação com API real. O aplicativo continua **não autorizado para produção**; consulte as issues #4 (autenticação nativa) e #5 (GPS operacional).
