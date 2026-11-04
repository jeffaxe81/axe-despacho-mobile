import type { AgentOfflineScope } from "./agentOffline";

const PREFIX = "dispatch.offline.agent.v1.";
type Store = Pick<Storage, "length"|"key"|"removeItem">;

/** Only remove data owned by this mobile app; never clear unrelated app storage. */
export function clearFieldCache(storage:Store):number {
  const keys:string[]=[];
  for(let i=0;i<storage.length;i++){
    const key=storage.key(i);
    if(key?.startsWith(PREFIX))keys.push(key);
  }
  let cleared=0;
  for(const key of keys){try{storage.removeItem(key);cleared++;}catch{/* unavailable */}}
  return cleared;
}
export function clearFieldSession():void {
  try{clearFieldCache(window.sessionStorage)}catch{/* unavailable */}
  try{clearFieldCache(window.localStorage)}catch{/* unavailable */}
}
export function summaryKeyFor(scope:AgentOfflineScope) {
  if(!Number.isSafeInteger(scope.userId)||scope.userId<=0||
    !Number.isSafeInteger(scope.organizationId)||scope.organizationId<=0||
    !Number.isSafeInteger(scope.teamId)||scope.teamId<=0)throw new Error("Escopo inválido.");
  return PREFIX+scope.userId+"."+scope.organizationId+"."+scope.teamId+".list";
}
