import { Capacitor } from "@capacitor/core";
import { useState } from "react";
import { statusLabels } from "../lib/contracts";
import {
  applyDemoAction,initialDemoState,permittedDemoActions,selectDemo,
  DEMO_LABEL,type DemoAction
} from "../lib/fieldDemo";

const actionLabels:Record<DemoAction,string> = {
  accept:"Aceitar despacho",decline:"Recusar despacho",start:"Iniciar atendimento",
  pause:"Pausar atendimento",resume:"Retomar atendimento",finish:"Concluir ocorrência"
};
export function AndroidFieldDemo() {
  const [session,setSession]=useState(initialDemoState);
  const [simulateNoNetwork,setSimulateNoNetwork]=useState(false);
  const [message,setMessage]=useState("");
  // The Android prototype is expressly offline/illustrative, never part of authenticated production UX.
  if(Capacitor.getPlatform()!=="android")return null;
  const selected=session.incidents.find(i=>i.id===session.selectedId)!;
  const actions=permittedDemoActions(selected.status);
  function act(action:DemoAction) {
    if(simulateNoNetwork)return;
    if((action==="finish"||action==="decline") &&
      !window.confirm("Confirmar somente a simulação? Isso NÃO altera a central."))return;
    try {
      setSession(current=>applyDemoAction(current,selected.id,action));
      setMessage("Mudança simulada apenas na memória deste aparelho. Nenhum envio realizado.");
    } catch(error) {
      setMessage(error instanceof Error?error.message:"Falha no exercício.");
    }
  }
  return <section className="panel android-demo" aria-label="Demonstração Android de despacho">
    <div className="demo-banner" role="status"><strong>{DEMO_LABEL}</strong><span>Sem login, sem dados reais, sem API e sem gravação de ocorrências.</span></div>
    <div className="section-head"><div><h2>Simulador de atendimento Android</h2><p>Teste os fluxos de despacho em um telefone ou tablet.</p></div><span className="pill">Demo</span></div>
    <label className="toggle"><input type="checkbox" checked={simulateNoNetwork} onChange={e=>setSimulateNoNetwork(e.target.checked)}/>
      Simular ausência de conexão
    </label>
    {simulateNoNetwork&&<p className="notice warning">Modo simulado sem conexão: comandos bloqueados. Os exemplos continuam disponíveis apenas para leitura.</p>}
    <div className="demo-layout">
      <div className="demo-selector" role="group" aria-label="Ocorrências demonstrativas">
        {session.incidents.map(i=><button className={"incident-card "+(selected.id===i.id?"selected":"")} type="button" key={i.id} onClick={()=>{setSession(current=>selectDemo(current,i.id));setMessage("");}}>
          <span className="incident-heading"><strong>{i.code}</strong><span className="priority">{i.priority}</span></span>
          <span className="incident-category">{i.category}</span>
          <span className="incident-status">{statusLabels[i.status]}</span>
        </button>)}
      </div>
      <div className="demo-detail">
        <h3>{selected.code} · {selected.category}</h3>
        <p className="detail"><strong>Situação:</strong> {statusLabels[selected.status]}</p>
        <p className="detail"><strong>Local:</strong> {selected.address}</p>
        <p className="detail description">{selected.description}</p>
        <div className="button-grid">
          {actions.map(action=><button key={action} type="button" className={action==="finish"||action==="accept"?"primary":"secondary"} onClick={()=>act(action)} disabled={simulateNoNetwork}>
            {actionLabels[action]}
          </button>)}
        </div>
        {actions.length===0&&<p className="hint">Este exemplo não possui novas transições disponíveis.</p>}
        {message&&<p className="hint" role="status">{message}</p>}
        <button className="secondary demo-reset" type="button" onClick={()=>{setSession(initialDemoState());setSimulateNoNetwork(false);setMessage("Simulação reiniciada.");}}>Reiniciar simulação</button>
      </div>
    </div>
    <h3 className="demo-history-heading">Histórico demonstrativo (somente RAM)</h3>
    {session.events.length===0?<p className="hint">Nenhum comando simulado ainda.</p>:
      <ol className="demo-history">{session.events.map(event=><li key={event.id}>
        <strong>{event.code}</strong> · {actionLabels[event.action]} · {new Date(event.at).toLocaleTimeString("pt-BR")}
      </li>)}</ol>}
    <p className="hint">Fechar ou atualizar o aplicativo descarta as alterações da simulação. Utilize a PWA autenticada para operações reais.</p>
  </section>;
}
