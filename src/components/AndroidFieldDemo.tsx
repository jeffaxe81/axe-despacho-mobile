import { Capacitor } from "@capacitor/core";
import { useState } from "react";
import { TouchSignaturePad } from "./TouchSignaturePad";
import { createDemoDispatchPdf } from "../lib/demoSignaturePdf";
import { deliverDemoPdf } from "../lib/demoPdfDelivery";
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
  const [pdfBusy,setPdfBusy]=useState(false);
  const [pdfHash,setPdfHash]=useState<{incidentId:number;value:string}|null>(null);
  const [signaturePreview,setSignaturePreview]=useState<{incidentId:number;pngDataUrl:string;capturedAt:number}|null>(null);
  // The Android prototype is expressly offline/illustrative, never part of authenticated production UX.
  if(Capacitor.getPlatform()!=="android")return null;
  const selected=session.incidents.find(i=>i.id===session.selectedId)!;
  const actions=permittedDemoActions(selected.status);
  function act(action:DemoAction) {
    if(simulateNoNetwork || pdfBusy)return;
    if((action==="finish"||action==="decline") &&
      !window.confirm("Confirmar somente a simulação? Isso NÃO altera a central."))return;
    try {
      setSignaturePreview(null);
      setPdfHash(null);
      setSession(current=>applyDemoAction(current,selected.id,action));
      setMessage("Mudança simulada apenas na memória deste aparelho. Nenhum envio realizado.");
    } catch(error) {
      setMessage(error instanceof Error?error.message:"Falha no exercício.");
    }
  }
  async function exportReport() {
    if (pdfBusy || !signaturePreview || signaturePreview.incidentId!==selected.id || selected.status!=="concluida") return;
    setPdfBusy(true); setMessage("");
    try {
      const result = await createDemoDispatchPdf({
        incident: {...selected},
        pngDataUrl: signaturePreview.pngDataUrl,
        capturedAt: signaturePreview.capturedAt,
      });
      await deliverDemoPdf(result);
      setPdfHash({incidentId:selected.id,value:result.pdfSha256});
      setMessage("PDF fictício preparado. SHA-256 disponível abaixo. Nenhum dado foi enviado à central.");
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Nao foi possivel excluir o PDF temporario")) {
        setMessage("O PDF foi compartilhado, mas a remoção do arquivo temporário falhou. Limpe o cache do aplicativo Android.");
      } else {
        setMessage("Não foi possível gerar ou compartilhar o PDF de teste. Nenhuma ocorrência foi alterada.");
      }
    } finally {
      setPdfBusy(false);
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
        {session.incidents.map(i=><button className={"incident-card "+(selected.id===i.id?"selected":"")} type="button" key={i.id} disabled={pdfBusy} onClick={()=>{if(pdfBusy)return;setSession(current=>selectDemo(current,i.id));setSignaturePreview(null);setPdfHash(null);setMessage("");}}>
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
        {selected.status==="concluida"&&<div className="demo-signature-report">
          <div className="section-head">
            <h3>Documento de encerramento</h3><span className="pill">Fictício</span>
          </div>
          <p className="detail"><strong>Ocorrência:</strong> {selected.code}</p>
          <p className="detail"><strong>Descrição:</strong> {selected.description}</p>
          {signaturePreview?.incidentId===selected.id?
            <div className="touch-signature-preview" aria-label="Assinatura demonstrativa confirmada">
              <p className="hint">Assinatura capturada somente neste aparelho, nesta sessão.</p>
              <img src={signaturePreview.pngDataUrl} alt="Traços manuscritos capturados na demonstração" />
              <p className="hint">Capturada em {new Date(signaturePreview.capturedAt).toLocaleString("pt-BR")}. PDF disponível apenas após geração manual; sem assinatura digital certificada.</p>
              <button type="button" className="secondary" disabled={pdfBusy} onClick={()=>{setSignaturePreview(null);setPdfHash(null);}}>Refazer assinatura</button>
              <button type="button" className="primary" disabled={pdfBusy} onClick={()=>void exportReport()}>
                {pdfBusy?"Preparando PDF...":"Gerar e compartilhar PDF de teste"}
              </button>
              {pdfHash?.incidentId===selected.id&&<p className="hint" role="status">
                SHA-256 do último PDF gerado: <code className="demo-pdf-hash">{pdfHash.value}</code>
              </p>}
            </div>:
            <TouchSignaturePad key={selected.id} code={selected.code}
              onConfirm={value=>{setSignaturePreview({incidentId:selected.id,...value});setMessage("Assinatura demonstrativa capturada. Nenhuma informação foi enviada à central.");}}/>
          }
        </div>}
        {selected.status!=="concluida"&&<p className="hint">A assinatura de teste fica disponível após concluir a ocorrência demonstrativa.</p>}
        {message&&<p className="hint" role="status">{message}</p>}
        <button className="secondary demo-reset" type="button" disabled={pdfBusy} onClick={()=>{setSession(initialDemoState());setSignaturePreview(null);setPdfHash(null);setSimulateNoNetwork(false);setMessage("Simulação reiniciada.");}}>Reiniciar simulação</button>
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
