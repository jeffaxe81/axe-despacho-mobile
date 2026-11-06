import { Capacitor, registerPlugin } from "@capacitor/core";
import { useEffect, useState } from "react";

export type NativeAuthLabStatus = {
  nativeLoginEnabled:boolean;
  authorizationEndpointEnabled:boolean;
  tokenExchangeEnabled:boolean;
  labOnly:boolean;
  hasPendingLabChallenge:boolean;
  hasEncryptedVaultData:boolean;
};
type LabChallenge = {
  mode:"offline-lab";
  codeChallengeMethod:"S256";
  codeChallenge:string;
  state:string;
  expiresAtMs:number;
  nativeLoginEnabled:false;
};
type NativeAuthLabPlugin = {
  status():Promise<NativeAuthLabStatus>;
  prepareLab():Promise<LabChallenge>;
  clearLab():Promise<{cleared:boolean;nativeLoginEnabled:boolean}>;
};
const Lab=registerPlugin<NativeAuthLabPlugin>("AxeNativeAuthLab");

/**
 * Explicit offline demo only. Never uses the challenge/state for a login:
 * the backend OAuth endpoints and verified App Links do not exist yet.
 * The verifier never crosses the Java bridge into the WebView.
 */
export function AndroidAuthLab() {
  const [status,setStatus]=useState<NativeAuthLabStatus|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const android=Capacitor.getPlatform()==="android";
  useEffect(()=>{
    if(!android)return;
    let active=true;
    void Lab.status().then(current=>{
      if(active)setStatus(current);
    }).catch(()=>{
      if(active)setMessage("Laboratório de autenticação indisponível neste APK.");
    });
    return()=>{active=false;};
  },[android]);
  if(!android)return null;
  async function runPrepare(){
    if(busy)return;
    setBusy(true);setMessage("");
    try {
      const result=await Lab.prepareLab();
      // Public PKCE challenge and state are not persisted or displayed.
      // The private verifier remains exclusively in Java process memory.
      setMessage(result.nativeLoginEnabled===false&&result.codeChallengeMethod==="S256"
        ? "Desafio PKCE S256 gerado no Android. Apenas teste local; nenhum login ou envio à central."
        : "Configuração inesperada: autenticação permanece bloqueada.");
      setStatus(await Lab.status());
    }catch(error){
      setMessage(error instanceof Error?error.message:"Preparação nativa indisponível.");
    }finally{setBusy(false);}
  }
  async function erase(){
    if(busy)return;
    setBusy(true);setMessage("");
    try{
      await Lab.clearLab();
      setStatus(await Lab.status());
      setMessage("Desafio de teste e cofre local apagados. Nenhuma sessão na central foi alterada.");
    }catch(error){
      setMessage(error instanceof Error?error.message:"Não foi possível limpar o laboratório.");
    }finally{setBusy(false);}
  }
  return <section className="panel login-panel" aria-label="Autenticação Android laboratório">
    <div className="section-head">
      <h2>Autenticação Android · laboratório</h2>
      <span className="pill">Sem login</span>
    </div>
    <p className="hint">
      Exercício local da geração de PKCE S256 e da proteção de credenciais pelo
      Android Keystore. Não abre navegador, não conecta à central e não concede acesso operacional.
    </p>
    <p className="detail"><strong>Autenticação nativa:</strong> bloqueada</p>
    <p className="detail"><strong>Desafio PKCE local:</strong> {status?.hasPendingLabChallenge?"gerado em memória":"não preparado"}</p>
    <p className="detail"><strong>API de troca de token:</strong> desabilitada</p>
    <div className="button-grid">
      <button className="secondary" type="button" onClick={()=>void runPrepare()} disabled={busy}>
        Gerar desafio PKCE de teste
      </button>
      <button className="secondary" type="button" onClick={()=>void erase()} disabled={busy}>
        Limpar laboratório
      </button>
    </div>
    {message&&<p className="notice" role="status">{message}</p>}
    <p className="hint">
      A versão Android operacional depende de App Link verificado, endpoints autorizados,
      vínculo criptográfico de dispositivo, Keystore e homologação da central.
    </p>
  </section>;
}
