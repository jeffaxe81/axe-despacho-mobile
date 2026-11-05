import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./lib/api";
import { activeAssigned, isFieldUser, statusLabels } from "./lib/contracts";
import type { Access, AssignmentRow, FieldUser, IncidentStatus, TenantSelection } from "./lib/contracts";
import { agentOfflineKey, loadAuthorizedAssignmentSnapshot, saveLastAuthorizedAssignments } from "./lib/agentOffline";
import type { AgentOfflineAssignment, AgentOfflineScope } from "./lib/agentOffline";
import { clearFieldSession } from "./lib/deviceStorage";
import { useFieldLocation } from "./hooks/useFieldLocation";
import { useForegroundLifecycle } from "./hooks/useForegroundLifecycle";
import { AndroidGpsLab } from "./components/AndroidGpsLab";
import { AndroidFieldDemo } from "./components/AndroidFieldDemo";
import { markPendingLogout,hasPendingLogout,clearPendingLogout,assertSessionFenceWritable,shouldRevokeForLogoutFenceEvent } from "./lib/sessionFence";
import { loadVerifiedTeamSnapshot } from "./lib/teamSnapshot";
import { ApiError } from "./lib/api";
import { isAccessRevoked } from "./lib/sessionAccess";
import { SessionEpoch } from "./lib/sessionEpoch";
import { FIELD_REFRESH_INTERVAL_MS,isFieldSnapshotFresh,shouldQueryLiveAssignments,timeSinceVerification } from "./lib/clientFreshness";

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
  const [logoutPending,setLogoutPending]=useState(()=>{
    try { return hasPendingLogout(window.localStorage); }
    catch { return true; } // refuse a session when logout state is unreadable
  });
  const [lastVerifiedAt,setLastVerifiedAt]=useState<number|null>(null);
  const [clock,setClock]=useState(Date.now());
  const [refreshSequence,setRefreshSequence]=useState(0);
  const [totalOccurrences,setTotalOccurrences]=useState(0);
  const [activeCount,setActiveCount]=useState(0);
  const [sharing,setSharing]=useState(false);
  const sessionEpoch=useRef(new SessionEpoch()).current;
  const foreground=useForegroundLifecycle(()=>{
    setSharing(false);
    setMustValidate(true);
  });
  const [persistOnDevice,setPersistOnDevice]=useState(false);
  const [savedRows,setSavedRows]=useState<AgentOfflineAssignment[]|null>(null);
  const [savedUntil,setSavedUntil]=useState<number|null>(null);
  const [message,setMessage]=useState("");
  const [copyMessage,setCopyMessage]=useState("");
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [note,setNote]=useState("");
  const native=Capacitor.isNativePlatform();
  const canField=isFieldUser(user,access,orgId) &&
    Array.isArray(tenant?.organizations) &&
    tenant.organizations.some(org=>org.id===orgId);
  const active=activeAssigned(rows);
  // Global active counts come from status-filtered reads, NOT only the first 50 rows.
  const conflict=activeCount>1;
  const selected=rows.find(r=>r.incident.id===selectedId) ?? active[0] ?? rows.find(r=>r.incident.status==="despachada") ?? rows[0];
  const recentlyVerified=isFieldSnapshotFresh(lastVerifiedAt,clock);
  const controlsEnabled=Boolean(!native && !logoutPending && canField && online && foreground && recentlyVerified && !mustValidate && !working && !conflict);
  const canSendGPS=Boolean(controlsEnabled && activeCount===1 && active.length===1 && sharing);
  const scope:AgentOfflineScope|null=useMemo(()=>{
    if (!user?.teamId || !orgId || !user.active) return null;
    return {userId:user.id,organizationId:orgId,teamId:user.teamId};
  },[user?.id,user?.teamId,user?.active,orgId]);

  // Revoking a session must erase incident details and all offline summaries,
  // not merely disable command buttons. No automatic write/retry is attempted.
  const revokeLocalAccess=useCallback((reason:string)=>{
    // Fence in-flight auth, incident reads and mutations before React renders.
    sessionEpoch.revoke();
    setWorking(false);
    setSharing(false);setMustValidate(true);setLastVerifiedAt(null);
    setUser(null);setTenant(null);setOrgId(null);setAccess(null);
    setRows([]);setTotalOccurrences(0);setActiveCount(0);setSelectedId(null);
    setSavedRows(null);setSavedUntil(null);setPersistOnDevice(false);
    setCopyMessage("");setNote("");setPassword("");
    clearFieldSession();
    setMessage(reason);
  },[sessionEpoch]);

  const onLocationAccessRevoked=useCallback(()=>{
    revokeLocalAccess("A central revogou a sessão ou o acesso ao GPS. Faça login novamente.");
  },[revokeLocalAccess]);
  const location=useFieldLocation({
    enabled:canSendGPS,teamId:user?.teamId,organizationId:orgId,
    onAccessRevoked:onLocationAccessRevoked
  });

  const bootstrap=useCallback(async()=>{
    const ticket=sessionEpoch.beginAuthentication();
    // Do not attempt API auth from a different-origin Android/iOS WebView.
    if(Capacitor.isNativePlatform()){
      setUser(null);setTenant(null);setOrgId(null);setAccess(null);
      setLoading(false);setLoaded(true);return;
    }
    // Identity may have changed in a different tab while this PWA was open.
    // Hide details before refreshing auth.me / tenant.selection / access.me.
    setSharing(false);setMustValidate(true);setLastVerifiedAt(null);
    // Never show the previous identity during an asynchronous revalidation.
    setUser(null);setTenant(null);setOrgId(null);setAccess(null);
    setRows([]);setSelectedId(null);setTotalOccurrences(0);setActiveCount(0);
    setSavedRows(null);setSavedUntil(null);setPersistOnDevice(false);
    setCopyMessage("");
    setLoading(true);setMessage("");
    try {
      // Refuse all cookie-based authentication when the persistent logout fence
      // cannot be reliably written and read by this browser.
      assertSessionFenceWritable(window.localStorage);
      // A failed logout must be completed remotely before any cookie is reused.
      let pending=true;
      try{ pending=hasPendingLogout(window.localStorage); }
      catch{ pending=true; }
      if(pending){
        setLogoutPending(true);
        if(!networkAvailable()) {
          setUser(null);setAccess(null);setTenant(null);setOrgId(null);
          setMessage("Saída remota pendente: conecte à central e tente confirmar o encerramento.");
          return;
        }
        try {
          await api.logout();
          if(!sessionEpoch.isCurrent(ticket))return;
          clearPendingLogout(window.localStorage);
          setLogoutPending(false);
        } catch {
          if(!sessionEpoch.isCurrent(ticket))return;
          setUser(null);setAccess(null);setTenant(null);setOrgId(null);
          setMessage("Saída remota ainda não confirmada. Os comandos estão bloqueados.");
          return;
        }
      }
      const current=await api.me();
      if(!sessionEpoch.isCurrent(ticket))return;
      if(!current){setUser(null);setTenant(null);setOrgId(null);setAccess(null);setRows([]);return;}
      const selection=await api.tenant();
      if(!sessionEpoch.isCurrent(ticket))return;
      const permissions=await api.access();
      if(!sessionEpoch.isCurrent(ticket))return;
      // Only a current, fully checked authentication can unlock live work.
      if(!sessionEpoch.grant(ticket))return;
      setUser(current);setTenant(selection);setAccess(permissions);
      setOrgId(selection.activeOrganizationId);
    } catch(cause){
      if(!sessionEpoch.isCurrent(ticket))return;
      if(isAccessRevoked(cause)){
        revokeLocalAccess("A sessão expirou ou a central revogou o acesso. Faça login novamente.");
        setLoading(false);setLoaded(true);
      } else {
        setMessage(errorText(cause));
        setUser(null);setTenant(null);setAccess(null);setOrgId(null);
      }
    } finally {
      // A stale bootstrap cannot dismiss the loading state of a newer login.
      if(sessionEpoch.isCurrent(ticket)){setLoading(false);setLoaded(true);}
    }
  },[revokeLocalAccess,sessionEpoch]);
  useEffect(()=>{void bootstrap();},[bootstrap]);
  useEffect(()=>{
    const onFence=(event:StorageEvent)=>{
      // Any non-null fence value (including malformed values) blocks this tab.
      if(!shouldRevokeForLogoutFenceEvent(event.key,event.newValue))return;
      // Another tab requested logout. Revoke operational UI in this tab too.
      setLogoutPending(true);
      revokeLocalAccess("Outra aba solicitou a saída. A sessão de campo foi bloqueada.");
    };
    window.addEventListener("storage",onFence);
    return()=>window.removeEventListener("storage",onFence);
  },[revokeLocalAccess]);
  useEffect(()=>{
    const offline=()=>{setOnline(false);setMustValidate(true);setSharing(false);};
    const onlineAgain=()=>{setOnline(true);setMustValidate(true);setSharing(false);};
    window.addEventListener("offline",offline);
    window.addEventListener("online",onlineAgain);
    return ()=>{window.removeEventListener("offline",offline);window.removeEventListener("online",onlineAgain);};
  },[]);
  useEffect(()=>{
    const interval=window.setInterval(()=>setClock(Date.now()),5000);
    return()=>window.clearInterval(interval);
  },[]);
  useEffect(()=>{
    if(!shouldQueryLiveAssignments(canField,online,foreground,native) || !orgId){
      setRows([]);setSelectedId(null);setMustValidate(true);
      setLastVerifiedAt(null);setTotalOccurrences(0);setActiveCount(0);
      return;
    }
    // Suspend polling while a mutation or login/logout transition is pending.
    if(working)return;
    let cancelled=false;
    let inFlight=false;
    let controller:AbortController|null=null;
    const poll=async()=>{
      const ticket=sessionEpoch.snapshot();
      if(cancelled || inFlight || !sessionEpoch.isOperational(ticket))return;
      const nextController=new AbortController();
      controller=nextController;
      inFlight=true;
      try {
        const result=await loadVerifiedTeamSnapshot(
          user?.teamId,
          (status,signal)=>api.assignments(orgId,signal,status),
          nextController.signal
        );
        if(cancelled || nextController.signal.aborted || !sessionEpoch.isOperational(ticket))return;
        setRows(result.rows);
        setTotalOccurrences(result.total);
        setActiveCount(result.activeCount);
        setClock(Date.now());
        setLastVerifiedAt(Date.now());
        setMustValidate(false);
        setMessage(current=>current.startsWith("Atualizando as ocorrências") ||
          current.startsWith("Não foi possível validar as atribuições") ? "" : current);
      } catch(cause) {
        if(cancelled || nextController.signal.aborted || !sessionEpoch.isOperational(ticket))return;
        if(isAccessRevoked(cause)){
          revokeLocalAccess("A central revogou a sessão ou as permissões da equipe. Faça login novamente.");
          return;
        }
        setMustValidate(true);setLastVerifiedAt(null);setSharing(false);
        if(cause instanceof ApiError && ["UNAUTHORIZED","FORBIDDEN","TEAM_SCOPE_MISMATCH","INVALID_ASSIGNMENTS","INCONSISTENT_TEAM_SNAPSHOT"].includes(cause.code)) {
          setRows([]);setTotalOccurrences(0);setActiveCount(0);
        }
        setMessage("Não foi possível validar as atribuições na central: "+errorText(cause));
      } finally {
        inFlight=false;
        if(controller===nextController)controller=null;
      }
    };
    setMustValidate(true);setLastVerifiedAt(null);setSavedRows(null);
    void poll();
    const timer=window.setInterval(()=>{if(!document.hidden)void poll();},FIELD_REFRESH_INTERVAL_MS);
    return()=>{
      cancelled=true;
      controller?.abort();
      window.clearInterval(timer);
    };
  },[canField,orgId,online,foreground,native,user?.id,user?.teamId,working,refreshSequence,revokeLocalAccess,sessionEpoch]);
  useEffect(()=>{setNote("");},[selected?.incident.id]);
  useEffect(()=>{
    if(savedUntil===null)return;
    const remaining=Math.max(0,savedUntil-Date.now());
    const timeout=window.setTimeout(()=>{setSavedRows(null);setSavedUntil(null);},remaining);
    return()=>window.clearTimeout(timeout);
  },[savedUntil]);

  function refresh() {
    if(!shouldQueryLiveAssignments(canField,online,foreground,native) || !orgId || working)return;
    setMustValidate(true);setLastVerifiedAt(null);
    setRefreshSequence(current=>current+1);
    setMessage("Atualizando as ocorrências com a central...");
  }
  async function signIn(e:React.FormEvent) {
    e.preventDefault();
    const ticket=sessionEpoch.snapshot();
    if(logoutPending){setMessage("Confirme o encerramento remoto da sessão antes de entrar.");return;}
    if(native){setMessage("O login no Android exige a etapa de autenticação nativa. Utilize a PWA da central por enquanto.");return;}
    if(working)return;
    try { assertSessionFenceWritable(window.localStorage); }
    catch { setMessage("Armazenamento seguro de sessão indisponível. Não é possível iniciar uma sessão neste navegador."); return; }
    setWorking(true);setMessage("");
    try {
      await api.login(username.trim(),password);
      if(!sessionEpoch.isCurrent(ticket))return;
      setPassword("");
      await bootstrap();
    } catch(cause){
      if(sessionEpoch.isCurrent(ticket))setMessage(errorText(cause));
    }
    finally{setWorking(false);}
  }
  async function signOut() {
    // Erase data immediately; remote logout may take seconds or time out.
    revokeLocalAccess("Encerrando sessão na central...");
    const ticket=sessionEpoch.snapshot();
    setWorking(true);
    setLogoutPending(true);
    try { markPendingLogout(window.localStorage); }
    catch { setMessage("Armazenamento indisponível: o encerramento deve ser confirmado na central."); }
    try {
      await api.logout();
      if(!sessionEpoch.isCurrent(ticket))return;
      clearPendingLogout(window.localStorage);
      setLogoutPending(false);
      setMessage("Sessão encerrada e confirmada na central.");
    } catch {
      if(!sessionEpoch.isCurrent(ticket))return;
      setLogoutPending(true);
      setMessage("Saída remota não confirmada. A sessão foi bloqueada neste dispositivo. Reconecte e confirme o logout.");
    } finally {
      clearFieldSession();
      setUser(null);setAccess(null);setOrgId(null);setTenant(null);setRows([]);setTotalOccurrences(0);setActiveCount(0);setLastVerifiedAt(null);
      setPassword("");setSelectedId(null);setSavedRows(null);setSavedUntil(null);
      setPersistOnDevice(false);
      if(sessionEpoch.isCurrent(ticket))setWorking(false);
    }
  }
  async function command(fn:()=>Promise<unknown>) {
    const ticket=sessionEpoch.snapshot();
    if(!controlsEnabled || !sessionEpoch.isOperational(ticket))return;
    setWorking(true);setMustValidate(true);setLastVerifiedAt(null);setMessage("");
    try {
      await fn();
      if(!sessionEpoch.isOperational(ticket))return;
      if(!orgId)throw new Error("Organização não selecionada.");
      const updated=await loadVerifiedTeamSnapshot(
        user?.teamId,(status,signal)=>api.assignments(orgId,signal,status)
      );
      if(!sessionEpoch.isOperational(ticket))return;
      setRows(updated.rows);
      setTotalOccurrences(updated.total);
      setActiveCount(updated.activeCount);
      setLastVerifiedAt(Date.now());setClock(Date.now());
      setMustValidate(false);
      setNote("");
      setMessage("Ação registrada. Situação atualizada com dados do servidor.");
    } catch(cause) {
      if(!sessionEpoch.isOperational(ticket))return;
      if(isAccessRevoked(cause)){
        revokeLocalAccess("A central rejeitou a sessão ou as permissões durante a ação. Faça login novamente.");
      } else {
        setMessage("Resultado da ação não confirmado. Consulte a central antes de tentar novamente.");
      }
    } finally {
      if(sessionEpoch.isCurrent(ticket))setWorking(false);
    }
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
    // Do not allow a forged or stale selector value to unlock scoped calls.
    if(!Number.isSafeInteger(value) || !tenant?.organizations?.some(o=>o.id===value)){
      setMessage("Organização não autorizada. Selecione uma organização da sua conta.");
      return;
    }
    sessionEpoch.changeScope();
    setSharing(false);setMustValidate(true);setLastVerifiedAt(null);setRows([]);setSavedRows(null);
    setSelectedId(null);setPersistOnDevice(false);setOrgId(value);
  }
  const fieldProblem=loaded && user && !canField && Boolean(tenant && orgId);

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">AXE</span><span><strong>Despacho Mobile</strong><small>Agente de campo · Android / iOS</small></span></div>
      <div className="header-actions"><span className={online?"net-online":"net-offline"}>{online?"Rede disponível":"Sem rede"}</span>{user&&<button className="link-button" onClick={()=>void signOut()} disabled={working}>Sair</button>}</div>
    </header>
    <main className="main">
      <div className="hero"><div><span className="eyebrow">Operação em campo</span><h1>Despachos no seu dispositivo</h1><p>Receba ocorrências, atualize a equipe e compartilhe sua localização com a central quando autorizado.</p></div><span className="device-label">{native?"Aplicativo nativo":"Aplicativo web"}</span></div>
      {!online&&<p className="notice warning" role="alert">Sem rede. Nenhuma alteração de status ou transmissão de GPS será iniciada. O resumo temporário só pode ser consultado após autenticação válida.</p>}
      {native&&<p className="notice warning" role="status">Prévia Android de homologação: a interface nativa está disponível, porém o login operacional e o GPS em segundo plano ainda exigem integração segura na central. Nenhuma senha será solicitada nesta versão nativa.</p>}
      {!foreground&&<p className="notice warning" role="status">O aplicativo foi colocado em segundo plano. O envio de GPS foi desligado e as ocorrências devem ser revalidadas ao retornar.</p>}
      {message&&<p className="notice" role="status">{message}</p>}
      {loading&&<p className="notice">Verificando sessão autenticada...</p>}
      {!loading&&logoutPending&&!native&&<section className="panel login-panel" role="alert">
        <h2>Saída remota pendente</h2>
        <p>O aplicativo bloqueou todas as operações porque o encerramento da sessão na central ainda não foi confirmado. A liberação exige uma nova comunicação HTTPS com o servidor.</p>
        <button className="primary" type="button" disabled={!online||working} onClick={()=>void bootstrap()}>Confirmar saída na central</button>
        <p className="hint">Não é necessário informar senha. Nenhuma operação será enviada enquanto o bloqueio estiver ativo.</p>
      </section>}
      {!loading&&!user&&!native&&!logoutPending&&<section className="panel login-panel"><h2>Entrar na central</h2><p>Use as credenciais do AXE Despacho. O aplicativo não armazena senha ou token.</p><form onSubmit={e=>void signIn(e)} className="login-form">
        <label>Usuário<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" minLength={3} maxLength={64} required /></label>
        <label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" minLength={12} required /></label>
        <button className="primary" type="submit" disabled={!online||working}>{working?"Conectando...":"Entrar"}</button>
      </form><p className="hint">Para acesso web, publique sob a mesma origem HTTPS da API. O acesso nativo exige integração adicional de autenticação.</p></section>}
      {native&&<section className="panel login-panel"><h2>Android · prévia técnica</h2><p>O APK de desenvolvimento permite validar instalação, layout e inicialização da WebView. Para operar ocorrências, utilize por enquanto a versão web da central em HTTPS.</p><p className="hint">Não use este APK para atendimento real. A próxima integração será a autenticação do dispositivo com credenciais protegidas e escopo de equipe.</p></section>}
      {native&&<AndroidFieldDemo />}
      {native&&<AndroidGpsLab />}
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
      {canField&&<p className={"notice "+(recentlyVerified&&!mustValidate?"":"warning")} role="status">{timeSinceVerification(lastVerifiedAt,clock)} · Atualização automática a cada 15 segundos com aplicativo ativo. {totalOccurrences>rows.length?`Exibindo ${rows.length} de ${totalOccurrences} registros. Consulte a central para os demais.`:""}</p>}
      {canField&&<div className="field-grid">
        <section className="panel">
          <div className="section-head"><div><h2>Ocorrências atribuídas</h2><p>{totalOccurrences} ocorrência(s) da equipe</p></div><button className="secondary" type="button" onClick={refresh} disabled={!online||working||!foreground}>{working?"Atualizando...":"Atualizar"}</button></div>
          {(mustValidate||!recentlyVerified)&&<p className="notice warning">Atribuições sem confirmação recente. Ações e GPS bloqueados até nova consulta à central.</p>}
          {conflict&&<p className="notice danger">Conflito: {activeCount} ocorrências ativas encontradas na equipe, inclusive fora da primeira página. Ações e localização bloqueadas.</p>}
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
              {selected.incident.status==="despachada"&&<div className="button-grid"><button className="primary" disabled={!controlsEnabled} onClick={()=>void command(()=>api.respond(orgId!,selected.incident.id,true))}>Aceitar despacho</button><button className="secondary" disabled={!controlsEnabled} onClick={()=>{if(window.confirm("Confirma recusar o despacho real?"))void command(()=>api.respond(orgId!,selected.incident.id,false));}}>Recusar</button></div>}
              {["aceita","em_atendimento","pausada"].includes(selected.incident.status)&&<>
                <label className="note-label">Registro da ocorrência<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={1000} placeholder="Descreva a ação (mínimo 3 caracteres)" rows={3}/></label>
                <div className="button-grid">{(selected.incident.status==="aceita"?["em_atendimento"]:selected.incident.status==="pausada"?["em_atendimento"]:["pausada",...(access?.permissions.includes("occurrences.close")?["concluida"]:[])]).map(next=><button className={next==="concluida"?"primary":"secondary"} key={next} type="button" disabled={!controlsEnabled||note.trim().length<3} onClick={()=>{if(next!=="concluida"||window.confirm("Confirma concluir a ocorrência real?"))void command(()=>api.transition(orgId!,selected.incident.id,selected.incident.status,next as IncidentStatus,note,selected.incident.statusRevision));}}>{next==="em_atendimento"?"Iniciar/Retomar":next==="pausada"?"Pausar":"Concluir"}</button>)}</div>
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
