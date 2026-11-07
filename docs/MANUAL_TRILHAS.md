# Manual do AXE Despacho Mobile — trilhas por perfil e situação

**Versão:** pré-produção, 07/11/2026 · **Prioridade:** Android, depois iOS.  
**Fonte de verdade:** central [AXE Despacho](https://github.com/jeffaxe81/dispatch).  
**Regra:** este manual não é autorização para operação real e não substitui os gates de homologação.

Este manual está disponível de forma resumida no próprio aplicativo, em **Manual e trilhas guiadas**, sem login. Marcar etapas no app gera apenas um checklist na memória da tela: nenhuma ação de atendimento, permissão ou alteração de servidor ocorre como resultado de marcar uma etapa.

## Seleção da trilha

| Trilha | Perfil | Ambiente | Resultado esperado |
| --- | --- | --- | --- |
| T01 — Primeiro acesso | Agente | PWA na mesma origem HTTPS | Sessão e equipe autorizadas |
| T02 — Receber e atender | Agente | PWA autenticada | Operação confirmada pela central |
| T03 — GPS consentido | Agente | PWA autenticada, primeiro plano | Compartilhamento manual e limitado |
| T04 — Perda de conexão | Agente e suporte | PWA autenticada | Leitura mínima, sem operação offline |
| T05 — Simulador | Instrutor e agente | APK Android debug | Treinamento fictício sem API |
| T06 — PKCE/GPS de laboratório | QA e desenvolvimento | APK Android debug | Exercício isolado sem login ou coordenadas enviadas |
| T07 — APIs externas | Integrador e arquiteto | Documentação | Contrato e segurança aprovados antes de programar |
| T08 — Recuperação | Agente, suporte e QA | PWA ou laboratório | Revalidação e evidência sanitizada |

## T01 — Primeiro acesso web (autenticação real apenas na PWA autorizada)

1. Abra a instância web na **mesma origem HTTPS** da central, nunca uma página clonada ou IP não aprovado.
2. Entre com credenciais individuais. O aplicativo não oferece armazenamento de senha.
3. Verifique **empresa ativa**, identidade, equipe e permissão. Se não houver organização autorizada, peça ajuste à administração.
4. Confira se a indicação de sincronização é recente (limite de 45 segundos) antes de operar.
5. Aceite: a tela de ocorrências mostra apenas itens autorizados. Sessão expirada ou perfil inadequado bloqueiam os controles.

**Falha:** caso a PWA apresente erro relacionado a `tenant.selection`, não contorne o seletor nem tente criar IDs de empresa no navegador. Ver [lacunas](LACUNAS_E_TRATAMENTO.md#gap-01).

## T02 — Despacho, aceite e atendimento

1. Veja o total de ocorrências da equipe e o indicador de atualização.
2. Use **Buscar por código ou categoria** e o filtro de situação. Ambos filtram **somente registros carregados**; a central pode ter outras páginas. Use **Limpar filtros** para voltar à lista.
3. Abra a ocorrência correspondente; confira código, prioridade, estado e endereço.
4. Se estiver `despachada`, aceite ou recuse. Recusa exige confirmação.
5. Se estiver `aceita`, registre uma justificativa e inicie; se estiver `em_atendimento`, pause ou conclua conforme permissão. Retome após pausa.
6. Confirme a atualização da situação na central, sem repetir comando após timeout de resultado desconhecido.

**Aceite:** transições autorizadas e auditadas, sem dupla execução ou mudança de outra equipe. O frontend não substitui as verificações do backend.

## T03 — GPS opt-in em primeiro plano

1. Verifique que há **uma única ocorrência ativa**, sessão e atribuição recentes e rede disponível.
2. Acione manualmente o compartilhamento e aceite as permissões do sistema.
3. Leia a indicação de transmissão ou erro; coordenadas fora da precisão/idade aceitável são descartadas.
4. Interrompa o compartilhamento ao terminar. O app suspende o envio quando vai para segundo plano.
5. Não interprete o **serviço debug de laboratório** como GPS real da central.

**Aceite:** sincronização confirmada na central de testes, sem reaproveitamento de amostras antigas e sem gravação local indevida. A etapa de GPS Android com tela bloqueada permanece pendente.

## T04 — Rede ruim, resumo e retomada

1. Com sessão e escopo válidos, ative opcionalmente a persistência do resumo mínimo.
2. Salve/abra o resumo por até 15 minutos. Contém só código, categoria e estado.
3. Se faltar rede, não conclua nem aceite ocorrências; nenhuma fila de comandos é enviada ao reconectar.
4. Ao restaurar a rede, atualize e revalide permissões, equipe e atribuições.

**Aceite:** sem dados de endereço, descrição, GPS, token, senha ou anexos no resumo. Expiração invalida leitura.

## T05 — Treinamento Android fictício

1. Instale somente o APK debug do workflow de laboratório.
2. Abra **Simulador de atendimento Android** e confirme o aviso de demonstração.
3. Selecione uma ocorrência fictícia e pratique aceite, início, pausa, retomada e conclusão.
4. Ative **Simular ausência de conexão** e confira os botões bloqueados.
5. Reinicie para apagar as alterações somente em RAM.

**Aceite:** nenhuma credencial solicitada, alteração na central ou envio GPS.

## T06 — Laboratórios de segurança (QA)

1. No Android debug, gere um desafio PKCE S256 local e confirme que nenhum token ou sessão operacional foi criado.
2. Limpe o laboratório de autenticação.
3. Mediante consentimento de teste, inicie o GPS de laboratório; confira a notificação nativa.
4. Bloqueie a tela no aparelho de teste e verifique o horário da última captura, sem coordenadas ou transmissão.
5. Encerre explicitamente o serviço; anexe apenas evidências **sanitizadas**.

**Aceite de laboratório:** sem App Link ativo, sem autenticação de produção, sem acesso a dados pessoais. **Não aprova** `ANDROID-AUTH` ou `ANDROID-GPS`.

## T07 — Integração por API e API aberta futura

1. Consulte [catálogo atual](api/mobile-api-catalog.json) e [guia de APIs](API_ABERTAS_E_CONTRATOS.md).
2. Separe tRPC interno, com cookie e escopo, do catálogo OpenAPI de **simulação** existente no backend.
3. Veja [OpenAPI 3.1 proposto](api/openapi-external-proposal.yaml): é um **rascunho** com URLs `.invalid`, não um serviço implantado.
4. Defina o ator (agente, equipe ou sistema), escopos, consentimento, logs mínimos e limites.
5. Homologue autorização cruzada de tenant/equipe, sessão expirada, revogação, concorrência, idempotência e versionamento.
6. Só libere acesso externo após implementação da central, revisão de segurança e CI + homologação de API.

**Aceite:** nenhuma rota pública anônima de mutação; documentação refletindo endpoints efetivamente testados, com status explícito.

## T08 — Diagnóstico e recuperação

| Sintoma | Conduta segura | Responsável sugerido |
| --- | --- | --- |
| Login Android bloqueado | Manter `NATIVE_AUTH_PENDING`; homologar fluxo nativo com backend, PKCE e Keystore | Backend + segurança + Android |
| Nenhuma organização | Validar contrato `tenant.selection`, sessão e vínculo na central | Backend |
| Sem ocorrências apesar do total | Limpar filtro local, verificar primeiras páginas e fluxo de consistência | Agente + backend |
| GPS sem permissão | Conferir permissão/sensor sem envio repetido; registrar status sanitizado | QA Android |
| Dados desatualizados | Aguarde validação/atualize; não acione comandos sobre snapshot antigo | Agente |
| Logout remoto pendente | Não tentar novo login até a central confirmar revogação | Suporte |
| Operação com timeout | Verificar na central antes de tentar novamente; prevenir duplicação | Supervisão + backend |
| API externa não localizada | Não usar endpoint de simulação; formalizar gateway e contrato versionado | Arquitetura + backend |

## Testes recomendados de usabilidade

Aplicar roteiros com usuários de campo em telas de 320, 360, 390, 430 e 768px; verificar foco por teclado, leitor de tela, contraste, toques de pelo menos 44px, filtros não enganando o usuário, ajuda acessível sem login, recuperação de rede, avisos de sessão e redução de digitação. Registrar dispositivo/versão, roteiro, resultado, problema, responsável e evidência sem informações pessoais.

**Rastreabilidade:** [roadmap](ROADMAP.md), [catálogo de APIs](API_ABERTAS_E_CONTRATOS.md), [lacunas e plano](LACUNAS_E_TRATAMENTO.md), [gates reais](quality/mobile-release-gates.json).
