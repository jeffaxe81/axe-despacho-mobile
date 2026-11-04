import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./lib/api";
import { activeAssigned, isFieldUser, statusLabels } from "./lib/contracts";
import type { Access, AssignmentResult, AssignmentRow, FieldUser, IncidentStatus, TenantSelection } from "./lib/contracts";
import { agentOfflineKey, loadAuthorizedAssignmentSnapshot, saveLastAuthorizedAssignments } from "./lib/agentOffline";
import type { AgentOfflineAssignment, AgentOfflineScope } from "./lib/agentOffline";
import { clearFieldSession } from "./lib/deviceStorage";
import { useFieldLocation } from "./hooks/useFieldLocation";

function errorText(cause:unknown):string {
  return cause instanceof Error ? cause.message : "Operação indisponível. Verifique sua conexão.";
}
function redacted(rows:AssignmentRow[]):AgentOfflineAssignment[] {
  return rows.map(({incident})=>({id:incident.id,code:incident.code,category:incident.category,status:incident.status}));
}
function networkAvailable() {
  return typeof navigator==="undefined" ? true : navigator.onLine;
}
export default function App() {
  const [user,setUser]=useState<FieldUser|null>(null);
  const [tenant,setTenant]=useState<TenantSelection|null>(null);
  const [orgId,setOrgId]=useState<number|null>(null);
  const [access,setAccess]=useState<Access|null>(null);
  const [rows,setRows]=useState<AssignmentRow[]>([]);
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [online,setOnline]=useState(networkAvailable);
  const [mustValidate,setMustValidate]=useState(true);
  const [sharing,setSharing]=useState(false);
  const [foreground,setForeground]=useState(()=>typeof document==="undefined"||document.visibilityState!=="hidden");
  const [persistOnDevice,setPersistOnDevice]=useState(false);
  const [savedRows,setSavedRows]=useState<AgentOfflineAssignment[]|null>(null);
  const [savedUntil,setSavedUntil]=useState<number|null>(null);
  const [message,setMessage]=useState("");
  const [copyMessage,setCopyMessage]=useState("");
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [note,setNote]=useState("");
  const native=Capacitor.isNativePlatform();
  const canField=isFieldUser(user,access,orgId);
  const active=activeAssigned(rows);
  const conflict=active.length>1;
  const selected=rows.find(r=>r.incident.id===selectedId) ?? active[0] ?? rows.find(r=>r.incident.status==="despachada") ?? rows[0];
  const controlsEnabled=Boolean(!native && canField && online && foreground && !mustValidate && !working && !conflict);
  const canSendGPS=Boolean(controlsEnabled && active.length===1 && sharing);
  const location=useFieldLocation({enabled:canSendGPS,teamId:user?.teamId,organizationId:orgId});
  const scope:AgentOfflineScope|null=useMemo(()=>{
    if (!user?.teamId || !orgId || !user.active) return null;
    return {userId:user.id,organizationId:orgId,teamId:user.teamId};
  },[user?.id,user?.teamId,user?.active,orgId]);

  const bootstrap=useCallback(async()=>{
    // Do not attempt API auth from a different-origin Android/iOS WebView.
    if(Capacitor.isNativePlatform()){
      setUser(null);setTenant(null);setOrgId(null);setAccess(null);
      setLoading(false);setLoaded(true);return;
    }
    setLoading(true);setMessage("");
    try {
      const current=await api.me();
      setUser(current);
      if(!current){setTenant(null);setOrgId(null);setAccess(null);setRows([]);return;}
      const selection=await api.tenant();
      const permissions=await api.access();
      setTenant(selection);setAccess(permissions);
      setOrgId(selection.activeOrganizationId);
    } catch(cause){
      setMessage(errorText(cause));
      setUser(null);setTenant(null);setAccess(null);setOrgId(null);
    } finally {setLoading(false);setLoaded(true);}
  },[]);
  useEffect(()=>{void bootstrap();},[bootstrap]);
  useEffect(()=>{
    const onVisibilityChange=()=>{
      const visible=document.visibilityState!=="hidden";
      setForeground(visible);
      if(!visible){
        setSharing(false);
        setMustValidate(true);
      }
    };
    document.addEventListener("visibilitychange",onVisibilityChange);
    return()=>document.removeEventListener("visibilitychange",onVisibilityChange);
  },[]);
  useEffect(()=>{
    const offline=()=>{setOnline(false);setMustValidate(true);setSharing(false);};
    const onlineAgain=()=>{setOnline(true);setMustValidate(true);setSharing(false);};
    window.addEventListener("offline",offline);
    window.addEventListener("online",onlineAgain);
    return ()=>{window.removeEventListener("offline",offline);window.removeEventListener("online",onlineAgain);};
  },[]);
  useEffect(()=>{
    if(!canField || !orgId || !online) {
      setRows([]);setSelectedId(null);setMustValidate(true);return;
    }
    let cancelled=false;
    setMustValidate(true);
    setRows([]);
    setSavedRows(null);
    void api.assignments(orgId).then((data:AssignmentResult)=>{
      if(cancelled)return;
      setRows(data.rows);
      setMustValidate(false);
      setMessage("");
    }).catch(cause=>{
      if(!cancelled){setMustValidate(true);setMessage("Não foi possível validar a lista de despacho: "+errorText(cause));}
    });
    return()=>{cancelled=true;};
  },[canField,orgId,online,user?.id]);
  useEffect(()=>{
    if(savedUntil===null)return;
    const remaining=Math.max(0,savedUntil-Date.now());
    const timeout=window.setTimeout(()=>{setSavedRows(null);setSavedUntil(null);},remaining);
    return()=>window.clearTimeout(timeout);
  },[savedUntil]);

  async function refresh() {
    if(!canField || !orgId || !online)return;
    setMustValidate(true);setWorking(true);
    try {
      const fresh=await api.assignments(orgId);
      setRows(fresh.rows);
      setMustValidate(false);
      setMessage("Dados conferidos com a central.");
    } catch(cause) {
      setMessage("Consulta não validada: "+errorText(cause));
    } finally {setWorking(false);}
  }
  async function signIn(e:React.FormEvent) {
    e.preventDefault();
    if(native){setMessage("O login no Android exige a etapa de autenticação nativa. Utilize a PWA da central por enquanto.");return;}
    if(working)return;
    setWorking(true);setMessage("");
    try {
      await api.login(username.trim(),password);
      setPassword("");
      await bootstrap();
    } catch(cause){setMessage(errorText(cause));}
    finally{setWorking(false);}
  }
  async function signOut() {
    setSharing(false);setMustValidate(true);setWorking(true);
    try{await api.logout();setMessage("Sessão encerrada.");}
    catch{setMessage("Não foi possível confirmar logout remoto. Nenhuma ação local está autorizada.");}
    finally{
      clearFieldSession();
      setUser(null);setAccess(null);setOrgId(null);setTenant(null);setRows([]);
      setPassword("");setSelectedId(null);setSavedRows(null);setSavedUntil(null);
      setPersistOnDevice(false);setWorking(false);
    }
  }
  async function command(fn:()=>Promise<unknown>) {
    if(!controlsEnabled)return;
    setWorking(true);setMustValidate(true);setMessage("");
    try {
      await fn();
      if(!orgId)throw new Error("Organização não selecionada.");
      const updated=await api.assignments(orgId);
      setRows(updated.rows);
      setMustValidate(false);
      setNote("");
      setMessage("Ação registrada. Situação atualizada com dados do servidor.");
    } catch {
      setMessage("Resultado da ação não confirmado. Consulte a central antes de tentar novamente.");
    } finally {setWorking(false);}
  }
  function saveSummary() {
    if(!scope || mustValidate || !online || !canField || conflict)return;
    try {
      saveLastAuthorizedAssignments(persistOnDevice?localStorage:sessionStorage,scope,redacted(rows));
      setCopyMessage("Resumo mínimo salvo por até 15 minutos, sem endereços ou dados de GPS.");
    } catch {setCopyMessage("Não foi possível salvar a cópia temporária.");}
  }
  function openSummary() {
    if(!scope || !canField)return;
    try {
      const snapshot=loadAuthorizedAssignmentSnapshot(persistOnDevice?localStorage:sessionStorage,scope);
      setSavedRows(snapshot?.rows??null);
      setSavedUntil(snapshot?.expiresAt??null);
      setCopyMessage(snapshot?"Cópia somente leitura. Revalide com a central antes de operar.":"Não existe resumo válido ou ele expirou.");
    } catch {setSavedRows(null);setSavedUntil(null);setCopyMessage("Cópia indisponível.");}
  }
  function togglePersistence(enabled:boolean) {
    if(!enabled && scope){
      try{localStorage.removeItem(agentOfflineKey(scope,"list"));}catch{/* storage unavailable */}
    }
    setPersistOnDevice(enabled);
    setSavedRows(null);setSavedUntil(null);
    setCopyMessage(enabled?"Modo persistente opcional. O resumo expira em 15 minutos.":"Persistência desativada e cópia do dispositivo apagada.");
  }
  function chooseOrg(value:number) {
    setSharing(false);setMustValidate(true);setRows([]);setSavedRows(null);
    setSelectedId(null);setPersistOnDevice(false);setOrgId(value);
  }
  const fieldProblem=loaded && user && !canField && Boolean(tenant && orgId);

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">AXE</span><span><strong>Despacho Mobile</strong><small>Agente de campo · Android / iOS</small></span></div>
      <div className="header-actions"><span className={online?"net-online":"net-offline"}>{online?"Conectado":"Sem rede"}</span>{user&&<button className="link-button" onClick={()=>void signOut()} disabled={working}>Sair</button>}</div>
    </header>
    <main className="main">
      <div className="hero"><div><span className="eyebrow">Operação em campo</span><h1>Despachos no seu dispositivo</h1><p>Receba ocorrências, atualize a equipe e compartilhe sua localização com a central quando autorizado.</p></div><span className="device-label">{native?"Aplicativo nativo":"Aplicativo web"}</span></div>
      {!online&&<p className="notice warning" role="alert">Sem rede. Nenhuma alteração de status ou transmissão de GPS será iniciada. O resumo temporário só pode ser consultado após autenticação válida.</p>}
      {native&&<p className="notice warning" role="status">Prévia Android de homologação: a interface nativa está disponível, porém o login operacional e o GPS em segundo plano ainda exigem integração segura na central. Nenhuma senha será solicitada nesta versão nativa.</p>}
      {!foreground&&<p className="notice warning" role="status">O aplicativo foi colocado em segundo plano. O envio de GPS foi desligado e as ocorrências devem ser revalidadas ao retornar.</p>}
      {message&&<p className="notice" role="status">{message}</p>}
      {loading&&<p className="notice">Verificando sessão autenticada...</p>}
      {!loading&&!user&&!native&&<section className="panel login-panel"><h2>Entrar na central</h2><p>Use as credenciais do AXE Despacho. O aplicativo não armazena senha ou token.</p><form onSubmit={e=>void signIn(e)} className="login-form">
        <label>Usuário<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" minLength={3} maxLength={64} required /></label>
        <label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" minLength={12} required /></label>
        <button className="primary" type="submit" disabled={!online||working}>{working?"Conectando...":"Entrar"}</button>
      </form><p className="hint">Para acesso web, publique sob a mesma origem HTTPS da API. O acesso nativo exige integração adicional de autenticação.</p></section>}
      {native&&<section className="panel login-panel"><h2>Android · prévia técnica</h2><p>O APK de desenvolvimento permite validar instalação, layout e inicialização da WebView. Para operar ocorrências, utilize por enquanto a versão web da central em HTTPS.</p><p className="hint">Não use este APK para atendimento real. A próxima integração será a autenticação do dispositivo com credenciais protegidas e escopo de equipe.</p></section>}
      {user&&tenant&&tenant.organizations.length>0&&<section className="panel">
        <div className="section-head"><h2>Equipe e organização</h2><span className="pill">{user.name}</span></div>
        <div className="organization">
          <label htmlFor="organization">Empresa ativa</label>
          <select id="organization" value={orgId??""} onChange={e=>chooseOrg(Number(e.target.value))} disabled={working}>
            <option value="">Selecione a empresa</option>
            {tenant.organizations.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}
          </select>
        </div>
        <p className="hint">Perfil: {user.operationalRole} · Equipe: {user.teamId??"não vinculada"} · Todos os comandos são autorizados no servidor.</p>
      </section>}
      {user&&tenant&&tenant.organizations.length===0&&<p className="notice warning">Nenhuma organização autorizada para a conta. Solicite acesso à central.</p>}
      {fieldProblem&&<p className="notice warning">Este aplicativo é exclusivo do agente ativo vinculado a uma equipe e com permissões de consulta/transição. Confirme o perfil e o escopo na central.</p>}
      {canField&&<div className="field-grid">
        <section className="panel">
          <div className="section-head"><div><h2>Ocorrências atribuídas</h2><p>{rows.length} ocorrência(s) da equipe</p></div><button className="secondary" type="button" onClick={()=>void refresh()} disabled={!online||working}>{working?"Atualizando...":"Atualizar"}</button></div>
          {mustValidate&&<p className="notice warning">Atribuições ainda não validadas. Ações operacionais bloqueadas até confirmação da central.</p>}
          {conflict&&<p className="notice danger">Conflito: mais de uma ocorrência ativa para a equipe. Ações e localização bloqueadas.</p>}
          <div className="assignment-list">{rows.map(({incident})=><button key={incident.id} type="button" className={"incident-card "+(selected?.incident.id===incident.id?"selected":"")} onClick={()=>{setSelectedId(incident.id);setNote("");}}>
            <span className="incident-heading"><strong>{incident.code}</strong><span className="priority">{incident.priority}</span></span>
            <span className="incident-category">{incident.category}</span><span className="incident-status">{statusLabels[incident.status]}</span>
          </button>)}</div>
          {!rows.length&&!mustValidate&&<p className="empty">Nenhuma ocorrência atribuída a esta equipe.</p>}
        </section>
        <div className="field-column">
          <section className="panel">
            <div className="section-head"><h2>Atendimento</h2>{selected&&<span className="pill">{selected.incident.code}</span>}</div>
            {selected?<>
              <h3>{selected.incident.category}</h3><p className="detail"><strong>Prioridade:</strong> {selected.incident.priority} · {statusLabels[selected.incident.status]}</p>
              <p className="detail"><strong>Endereço:</strong> {selected.incident.address}</p>
              <p className="detail description">{selected.incident.description}</p>
              {selected.incident.status==="despachada"&&<div className="button-grid"><button className="primary" disabled={!controlsEnabled} onClick={()=>void command(()=>api.respond(orgId!,selected.incident.id,true))}>Aceitar despacho</button><button className="secondary" disabled={!controlsEnabled} onClick={()=>void command(()=>api.respond(orgId!,selected.incident.id,false))}>Recusar</button></div>}
              {["aceita","em_atendimento","pausada"].includes(selected.incident.status)&&<>
                <label className="note-label">Registro da ocorrência<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={1000} placeholder="Descreva a ação (mínimo 3 caracteres)" rows={3}/></label>
                <div className="button-grid">{(selected.incident.status==="aceita"?["em_atendimento"]:selected.incident.status==="pausada"?["em_atendimento"]:["pausada",...(access?.permissions.includes("occurrences.close")?["concluida"]:[])]).map(next=><button className={next==="concluida"?"primary":"secondary"} key={next} type="button" disabled={!controlsEnabled||note.trim().length<3} onClick={()=>void command(()=>api.transition(orgId!,selected.incident.id,selected.incident.status,next as IncidentStatus,note,selected.incident.statusRevision))}>{next==="em_atendimento"?"Iniciar/Retomar":next==="pausada"?"Pausar":"Concluir"}</button>)}</div>
              </>}
            </>:<p className="empty">Selecione uma ocorrência para consultar detalhes.</p>}
          </section>
          <section className="panel">
            <div className="section-head"><h2>Localização da equipe</h2><span className="pill">GPS</span></div>
            <p className="hint">O GPS é compartilhado somente quando houver exatamente uma ocorrência ativa, após seu comando. O mapa da central marca posições desatualizadas.</p>
            <label className="toggle"><input type="checkbox" checked={sharing&&controlsEnabled} disabled={!controlsEnabled||active.length!==1} onChange={e=>setSharing(e.target.checked)}/>Compartilhar localização enquanto o aplicativo estiver ativo</label>
            <p className={"location-message "+(location.status==="error"?"error":"")} role="status">{sharing?location.message||"Aguardando posição...":"Compartilhamento desativado."}</p>
            <p className="hint">Segundo plano com tela bloqueada requer serviço nativo homologado, permissões e notificação persistente. Não está ativo na versão atual.</p>
          </section>
          <section className="panel">
            <div className="section-head"><h2>Persistência opcional</h2><span className="pill">15 min</span></div>
            <p className="hint">Salva só código, categoria e estado; nunca coordenadas, descrição, endereço, credenciais ou anexos. Não autoriza operação sem rede.</p>
            <label className="toggle"><input type="checkbox" checked={persistOnDevice} onChange={e=>togglePersistence(e.target.checked)}/>Manter resumo após fechar a aba</label>
            <div className="button-grid"><button className="secondary" disabled={!controlsEnabled} type="button" onClick={saveSummary}>Salvar resumo</button><button className="secondary" type="button" onClick={openSummary}>Ver resumo</button></div>
            {copyMessage&&<p className="hint" role="status">{copyMessage}</p>}
            {savedRows&&<div className="snapshot">{savedRows.map(x=><p key={x.id}>{x.code} · {x.category} · {x.status}</p>)}{savedRows.length===0&&<p>Resumo vazio.</p>}</div>}
          </section>
        </div>
      </div>}
    </main>
    <footer className="footer">AXE Despacho Mobile · API autenticada · Sem acesso direto ao banco de dados</footer>
  </div>;
}
