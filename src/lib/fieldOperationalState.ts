/** Read-only explanation of command eligibility for field agents.
 * This helper is UX only. The actual command/GPS gates still operate against
 * the complete authorized snapshot, server permissions, scope and SessionEpoch.
 */
export type FieldOperationalInput={
  native:boolean;
  logoutPending:boolean;
  online:boolean;
  foreground:boolean;
  authorized:boolean;
  conflict:boolean;
  needsValidation:boolean;
  snapshotFresh:boolean;
  working:boolean;
};
export type FieldOperationalState={
  kind:"ready"|"warning"|"blocked"|"busy";
  message:string;
};
export function fieldOperationalState(input:FieldOperationalInput):FieldOperationalState{
  if(input.native)return {kind:"blocked",message:"Modo de laboratório: login e GPS nativos ainda não homologados."};
  if(input.logoutPending)return {kind:"blocked",message:"Saída remota pendente. Nenhuma operação autorizada."};
  if(!input.online)return {kind:"blocked",message:"Sem conexão com a central. Comandos e GPS bloqueados."};
  if(!input.foreground)return {kind:"blocked",message:"Aplicativo em segundo plano. Revalide as ocorrências."};
  if(!input.authorized)return {kind:"blocked",message:"Sessão, perfil ou equipe sem autorização de operação."};
  if(input.conflict)return {kind:"blocked",message:"Mais de uma ocorrência ativa na equipe. Consulte a supervisão."};
  if(input.needsValidation)return {kind:"warning",message:"Atualizando permissões e ocorrências. Operações temporariamente bloqueadas."};
  if(!input.snapshotFresh)return {kind:"warning",message:"Dados desatualizados. Aguarde a confirmação da central."};
  if(input.working)return {kind:"busy",message:"Operação em andamento. Evite repetir o comando."};
  return {kind:"ready",message:"Pronto para operar: sessão e ocorrências verificadas recentemente."};
}
