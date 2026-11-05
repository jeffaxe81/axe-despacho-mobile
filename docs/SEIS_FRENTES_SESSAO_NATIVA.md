# AXE Despacho — seis especialidades, ciclo de segurança de sessão

Data: 05/11/2026. Cliente: `jeffaxe81/axe-despacho-mobile`. Backend de referência: `jeffaxe81/dispatch`.

Este ciclo combina **seis perspectivas de revisão técnica** sobre a mesma entrega. Não representa seis pessoas independentes trabalhando ou seis processos de desenvolvimento externos. O escopo é **pré-produção**.

| Especialidade | Entrega verificável | Limite pendente |
| --- | --- | --- |
| Arquitetura | `SessionEpoch`: tickets efêmeros e invalidação de respostas pendentes por sessão/tenant | Snapshot transacional/versão de identidade no backend |
| Segurança | Revogação síncrona de acesso, limpeza de resumos e barreiras a respostas tardias de bootstrap e comandos | Testes instrumentados completos de múltiplas abas e auditoria de CSRF |
| Backend/API | As leituras e mutações continuam tRPC HTTPS, sem reenvio; resultados atrasados não podem sobrescrever o tenant atual | Fluxo de autenticação móvel aprovado e escopo de token no `dispatch` |
| Android | Teste cobrindo **todas as nove operações autenticadas**; WebView nativa continua emitindo `NATIVE_AUTH_PENDING` antes de chamar a rede | Authorization Code + PKCE e armazenamento no Keystore ainda não implementados |
| UX do agente | Identidade e ocorrências antigas escondidas durante autenticação e logout; cópias offline bloqueadas por sessão revogada | Testes físicos e validação de legibilidade/acessibilidade |
| QA | Cenários de respostas fora de ordem, logout, troca de organização e concorrência, preservando a matriz anterior de 1.000 cenários | E2E com central real, rede móvel e Android 14–16 |

## Garantias do cliente

1. Uma autenticação inicia novo ticket e mantém a UI operacional bloqueada até o retorno de `auth.me`, `tenant.selection` e `access.me`.
2. Logout, revogação, troca de organização, atualização manual, perda ou retorno da rede tornam inválidos resultados de consultas/mutações anteriores. A conclusão remota de uma ação em curso **não é revertida** pelo cliente; por isso, o resultado deve ser confirmado na central antes de nova ação.
3. Um callback antigo não pode reapresentar a identidade ou a lista de ocorrências de outro usuário/tenant. As operações continuam validadas no servidor.
4. Rascunhos e resumos permanecem sem senha, token, coordenadas, endereço e descrição persistentes, e não podem ser abertos quando a autorização da sessão foi revogada.
5. A etapa nativa permanece bloqueada: **não adicionamos fluxo de senha na WebView, persistência de token nem permissões GPS operacionais**.

## Contrato proposto para o backend — NÃO implementado

- Avaliar OAuth Authorization Code com **PKCE S256**, navegador de sistema e redirect por App Link verificado; nunca pedir senha pelo JavaScript da WebView.
- Definir sessão nativa vinculada a identidade, tenant, equipe, dispositivo autorizado, escopos, expiração curta, rotação e revogação; todos os recursos devem conferir isso novamente no servidor.
- Armazenar material de sessão somente por interface nativa sob Android Keystore; não disponibilizar refresh token à WebView; revisar prevenção a CSRF, token replay e validação rigorosa de issuer/audience.
- Priorizar a implementação e auditoria no repositório `jeffaxe81/dispatch`, com testes de tenant cruzado, sessão revogada, troca de equipe, dispositivo perdido e rede intermitente.
- Depois da homologação do login nativo, desenvolver integração GPS operacional autenticada com consentimento, retenção e limites de bateria (issue #5).

## Verificação

```sh
npm run check
npm run test:1000
npm test
npm run build
npm run android:debug
```

O build Android do GitHub gera somente APK de depuração. Os testes unitários não comprovam integração com a central real nem segurança do aparelho físico. Nenhuma dessas mudanças autoriza operação de despacho em produção.
