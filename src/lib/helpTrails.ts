/** Static, public and non-sensitive guided training content.
 * It never calls the backend and is available before user authentication.
 */
export type HelpEnvironment = "web" | "android";
export type HelpTrail = {
  id: string;
  title: string;
  audience: string;
  summary: string;
  environment: HelpEnvironment | "all";
  steps: readonly string[];
  caution: string;
};

export const HELP_TRAILS: readonly HelpTrail[] = [
  {
    id: "inicio-web",
    title: "Primeiro acesso à central",
    audience: "Agente · PWA autenticada",
    summary: "Confirme sua identidade e o vínculo com equipe e organização.",
    environment: "web",
    steps: [
      "Abra o Mobile na mesma origem HTTPS da central autorizada.",
      "Entre com sua conta individual; não compartilhe usuário e senha.",
      "Confira empresa, equipe e perfil de agente na tela.",
      "Aguarde a validação recente das ocorrências antes de agir."
    ],
    caution: "Sem vínculo de equipe, permissão ou sessão confirmada, comandos permanecem bloqueados."
  },
  {
    id: "despacho-web",
    title: "Receber e executar um despacho",
    audience: "Agente · PWA autenticada",
    summary: "Da atribuição ao encerramento, sempre com confirmação da central.",
    environment: "web",
    steps: [
      "Confira a atualização da equipe e procure o código entre as ocorrências carregadas.",
      "Abra a ocorrência, confira prioridade, endereço e situação.",
      "Aceite ou recuse apenas o despacho destinado à sua equipe.",
      "Registre nota de atendimento, inicie, pause ou retome conforme a situação.",
      "Conclua somente com permissão, justificativa e confirmação do servidor."
    ],
    caution: "Filtros são apenas visuais. Uma resposta incerta exige nova consulta, nunca repetição automática."
  },
  {
    id: "gps-web",
    title: "Compartilhar GPS com segurança",
    audience: "Agente · PWA autenticada",
    summary: "Consentimento explícito e uma ocorrência ativa por equipe.",
    environment: "web",
    steps: [
      "Confirme rede, permissão e uma única ocorrência ativa na equipe.",
      "Ative o compartilhamento manualmente na seção Localização.",
      "Aguarde a mensagem de envio confirmado; precisão insuficiente é recusada.",
      "Ao terminar, desligue o compartilhamento e confira a situação na central."
    ],
    caution: "Na PWA, o GPS é suspenso em segundo plano. O rastreamento Android operacional com tela bloqueada ainda não foi homologado."
  },
  {
    id: "offline-web",
    title: "Perda de conexão e resumo temporário",
    audience: "Agente · PWA autenticada",
    summary: "Ler informações mínimas sem transformar dados antigos em comandos.",
    environment: "web",
    steps: [
      "Durante sessão validada, opte pelo resumo mínimo temporário, caso seja necessário.",
      "Leia apenas códigos, categorias e estados; dados sensíveis não são salvos no resumo.",
      "Se a rede cair, não tente aceitar ou concluir ocorrências offline.",
      "Após reconectar, atualize e aguarde uma nova validação antes de operar."
    ],
    caution: "O resumo expira em 15 minutos; não há fila de alterações nem reenvio automático."
  },
  {
    id: "android-demo",
    title: "Treinamento no Android",
    audience: "Treinamento · APK de laboratório",
    summary: "Experimente as telas sem autenticar ou alterar a central.",
    environment: "android",
    steps: [
      "Abra o aplicativo Android de laboratório e identifique o aviso de simulação.",
      "Use ocorrências fictícias para praticar aceite, início, pausa e conclusão.",
      "Simule ausência de conexão e verifique o bloqueio das ações.",
      "Reinicie a demonstração para apagar as mudanças somente em memória."
    ],
    caution: "O APK debug não pode ser usado para atender casos reais; login nativo operacional está desabilitado."
  },
  {
    id: "android-labs",
    title: "Laboratórios PKCE e GPS",
    audience: "QA e homologação · Android",
    summary: "Exercícios nativos isolados e sem transmissão de dados.",
    environment: "android",
    steps: [
      "Gere um desafio PKCE S256 de teste e confirme que nenhum login é realizado.",
      "Limpe o laboratório de autenticação após o exercício.",
      "Se autorizado para o teste GPS, conceda permissão durante o uso e inicie a demonstração.",
      "Confira a notificação persistente e encerre o teste de GPS explicitamente."
    ],
    caution: "O laboratório GPS não envia coordenadas. O sucesso desses exercícios não aprova homologação física."
  },
  {
    id: "apis",
    title: "APIs e integrações autorizadas",
    audience: "Integrações · Técnico",
    summary: "Entenda contratos existentes e propostas de APIs externas.",
    environment: "all",
    steps: [
      "Use os procedimentos tRPC internos apenas com sessão HTTPS e escopo válido.",
      "Confirme o contrato real da central antes de desenvolver um conector externo.",
      "Separe o catálogo OpenAPI de simulação de APIs REST efetivamente publicadas.",
      "Para API pública futura, exija autenticação, escopo, limites, auditoria e idempotência.",
      "Homologue erros, troca de organização, revogação e documentação versionada antes do GO."
    ],
    caution: "Nenhuma nova API REST aberta ou autenticação nativa foi ativada por estas trilhas."
  },
  {
    id: "recuperacao",
    title: "Falhas e recuperação",
    audience: "Agente, suporte e QA",
    summary: "O que fazer ao perder rede, sessão, GPS ou sincronização.",
    environment: "all",
    steps: [
      "Sem rede: confira conectividade e não execute ações offline.",
      "Sessão revogada ou logout pendente: use apenas a central autorizada para revalidar.",
      "Atribuições inconsistentes: solicite nova validação e envolva a supervisão.",
      "GPS indisponível: confira permissão e precisão, sem insistir em reenvios.",
      "Registre o erro de forma sanitizada, sem senha, token, localização ou dados pessoais."
    ],
    caution: "Ao receber confirmação incerta de uma operação, confirme seu resultado na central antes de tentar novamente."
  }
];

export function availableHelpTrails(environment: HelpEnvironment): readonly HelpTrail[] {
  return HELP_TRAILS.filter(trail => trail.environment === "all" || trail.environment === environment);
}
