import { Capacitor, registerPlugin } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { useEffect, useState } from "react";
import { gpsLabDisplayLabels, gpsLabDisplayState } from "../lib/gpsLabStatus";

type LabStatus = {
  running:boolean;
  lastFixAt:number;
  uploadsEnabled:boolean;
};
type LabPlugin = {
  start():Promise<{requested:boolean}>;
  stop():Promise<void>;
  status():Promise<LabStatus>;
};
const Lab = registerPlugin<LabPlugin>("AxeLocationLab");
const EMPTY:LabStatus = {running:false,lastFixAt:0,uploadsEnabled:false};

/**
 * Android debug-only. These local tests NEVER send a location to dispatch.
 * The production network-enabled service awaits native auth + user consent.
 */
export function AndroidGpsLab() {
  const [status,setStatus]=useState<LabStatus>(EMPTY);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const android=Capacitor.getPlatform()==="android";
  useEffect(()=>{
    if(!android)return;
    let disposed=false;
    const read=()=>{
      void Lab.status().then(result=>{if(!disposed)setStatus(result);})
        .catch(()=>{if(!disposed)setMessage("Laboratório GPS indisponível neste APK.");});
    };
    read();
    const interval=window.setInterval(read,5000);
    return()=>{disposed=true;window.clearInterval(interval);};
  },[android]);
  if(!android)return null;
  const fixState=gpsLabDisplayState(status.running,status.lastFixAt,Date.now());

  const refresh=async()=>setStatus(await Lab.status());
  const start=async()=>{
    if(busy)return;
    const confirmed=window.confirm(
      "Iniciar o teste local de GPS? O Android exibirá uma notificação enquanto o serviço estiver ativo. " +
      "Nenhuma coordenada será enviada à central nem armazenada.");
    if(!confirmed)return;
    setBusy(true);setMessage("");
    try {
      const permissions=await Geolocation.requestPermissions();
      if(permissions.location!=="granted"&&permissions.coarseLocation!=="granted"){
        throw new Error("Autorize a localização durante o uso do aplicativo para iniciar o teste.");
      }
      await Lab.start();
      await refresh();
      setMessage("Início solicitado. Confira a notificação Android e o estado do serviço.");
    } catch(e) {
      setMessage(e instanceof Error?e.message:"Não foi possível iniciar o teste de GPS.");
    } finally {setBusy(false);}
  };
  const stop=async()=>{
    if(busy)return;
    setBusy(true);setMessage("");
    try {
      await Lab.stop();
      await refresh();
      setMessage("Solicitação de encerramento enviada ao Android.");
    } catch(e){
      setMessage(e instanceof Error?e.message:"Não foi possível encerrar o teste.");
    } finally {setBusy(false);}
  };

  return <section className="panel login-panel" aria-label="GPS Android de laboratório">
    <div className="section-head"><h2>GPS Android · laboratório</h2><span className="pill">Somente teste</span></div>
    <p className="hint">
      Permite testar a recepção de localização com a tela bloqueada. O serviço mantém
      somente o horário da última posição válida em memória; não registra latitude,
      longitude, histórico, identificação ou credenciais e não transmite à central.
    </p>
    <p className="detail" role="status">
      <strong>Serviço:</strong> {status.running?"ativo, com notificação do Android":"desligado"}
    </p>
    <p className="detail" role="status">
      <strong>Qualidade da captura:</strong> {gpsLabDisplayLabels[fixState]}.
      {fixState==="stale"?" Uma captura antiga não deve ser apresentada como posição atual.":""}
    </p>
    <p className="detail">
      <strong>Última captura válida:</strong>{" "}
      {status.running && status.lastFixAt>0 && Number.isFinite(status.lastFixAt) && status.lastFixAt<=Date.now()
        ?new Date(status.lastFixAt).toLocaleTimeString("pt-BR"):"nenhuma posição recente confirmada"}
    </p>
    <p className="detail"><strong>Envio à central:</strong> desabilitado</p>
    <div className="button-grid">
      <button className="primary" type="button" onClick={()=>void start()}
        disabled={busy||status.running}>Iniciar teste GPS</button>
      <button className="secondary" type="button" onClick={()=>void stop()}
        disabled={busy||!status.running}>Encerrar teste GPS</button>
    </div>
    {message&&<p className="notice" role="status">{message}</p>}
    <p className="hint">
      O rastreamento operacional permanece bloqueado até autenticação nativa,
      autorização da equipe e integração segura à API. Se o aplicativo for encerrado,
      o serviço de teste deverá parar. Também é possível encerrá-lo pela notificação.
    </p>
  </section>;
}
