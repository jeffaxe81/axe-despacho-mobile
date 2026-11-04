import type { Incident, IncidentStatus } from "./contracts";

/** Standalone, in-memory example data. This module never imports the network API. */
export type DemoAction = "accept"|"decline"|"start"|"pause"|"resume"|"finish";
export type DemoIncident = Incident;
export type DemoEvent = { id:number; code:string; action:DemoAction; at:number; status:IncidentStatus };
export type DemoState = { incidents:DemoIncident[]; selectedId:number; events:DemoEvent[]; nextEventId:number };
const demoSeed:DemoIncident[] = [
  { id:90001,code:"DEMO-001",status:"despachada",priority:"alta",category:"Atendimento simulado",address:"Rua Exemplo, 100 — endereço fictício",description:"Ocorrência criada somente para testar o aplicativo Android.",assignedTeamId:900 },
  { id:90002,code:"DEMO-002",status:"aceita",priority:"media",category:"Apoio simulado",address:"Avenida Teste, 250 — endereço fictício",description:"Exercício de mudança de situação, sem qualquer dado operacional.",assignedTeamId:900 },
  { id:90003,code:"DEMO-003",status:"concluida",priority:"baixa",category:"Registro de exemplo",address:"Local demonstrativo — sem localização real",description:"Registro concluído para demonstrar o histórico.",assignedTeamId:900 },
];
const transition: Record<DemoAction, {allowed:readonly IncidentStatus[]; to:IncidentStatus}> = {
  accept:{allowed:["despachada"],to:"aceita"},
  decline:{allowed:["despachada"],to:"aguardando_despacho"},
  start:{allowed:["aceita"],to:"em_atendimento"},
  pause:{allowed:["em_atendimento"],to:"pausada"},
  resume:{allowed:["pausada"],to:"em_atendimento"},
  finish:{allowed:["em_atendimento"],to:"concluida"},
};
export const DEMO_LABEL = "SIMULAÇÃO — NÃO CONECTADO À CENTRAL";
export function initialDemoState():DemoState {
  return { incidents:demoSeed.map(i=>({...i})), selectedId:90001, events:[], nextEventId:1 };
}
export function selectDemo(state:DemoState,id:number):DemoState {
  if(!state.incidents.some(incident=>incident.id===id))throw new Error("Ocorrência demonstrativa inexistente.");
  return {...state,selectedId:id};
}
export function permittedDemoActions(status:IncidentStatus):DemoAction[] {
  return (Object.entries(transition) as [DemoAction,(typeof transition)[DemoAction]][])
    .filter(([,rule])=>rule.allowed.includes(status)).map(([action])=>action);
}
export function applyDemoAction(state:DemoState,id:number,action:DemoAction,at=Date.now()):DemoState {
  const incident=state.incidents.find(i=>i.id===id);
  const rule=transition[action];
  if(!incident || !rule || !rule.allowed.includes(incident.status)) {
    throw new Error("Transição demonstrativa inválida: atualize a seleção.");
  }
  if(!Number.isFinite(at)||at<0)throw new Error("Horário demonstrativo inválido.");
  return {
    ...state,
    incidents:state.incidents.map(i=>i.id===id?{...i,status:rule.to}:i),
    events:[{id:state.nextEventId,code:incident.code,action,at,status:rule.to},...state.events].slice(0,20),
    nextEventId:state.nextEventId+1,
  };
}
