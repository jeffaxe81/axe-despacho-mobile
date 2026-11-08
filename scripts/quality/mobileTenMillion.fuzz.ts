import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { isFieldUser, statuses } from "../../src/lib/contracts";
import { validateAssignmentResult } from "../../src/lib/assignmentValidation";
import { loadVerifiedTeamSnapshot } from "../../src/lib/teamSnapshot";
import { SessionEpoch } from "../../src/lib/sessionEpoch";
import { isFieldSnapshotFresh, shouldQueryLiveAssignments, timeSinceVerification } from "../../src/lib/clientFreshness";
import { validLocation, shouldAttemptFreshLocation, GpsAttemptLedger } from "../../src/lib/gpsAttemptLedger";
import { AGENT_OFFLINE_TTL_MS, agentOfflineKey, loadAuthorizedAssignmentSnapshot,
  saveLastAuthorizedAssignments, saveAgentNoteDraft, loadAgentNoteDraft
} from "../../src/lib/agentOffline";
import { PENDING_LOGOUT_KEY, markPendingLogout, clearPendingLogout,
  hasPendingLogout, assertSessionFenceWritable, shouldRevokeForLogoutFenceEvent
} from "../../src/lib/sessionFence";
import { isAccessRevoked } from "../../src/lib/sessionAccess";
import { ApiError } from "../../src/lib/api";

/**
 * One million independent *scenario evaluations* per selected CI shard.
 *
 * Only ONE Vitest test item is registered in each shard to keep discovery,
 * memory and GitHub logs bounded. The 10M figure counts policy evaluations,
 * not 10M Vitest test registrations, 10M devices or operational homologations.
 *
 * All data are synthetic. No remote backend, storage device, Android/iOS
 * phone, GPS hardware, login, live traffic or production endpoint is touched.
 */
const GROUPS = [
  "rbac", "incident_contract", "team_snapshot", "session_epoch",
  "freshness", "lifecycle", "gps_integrity", "gps_antireplay",
  "offline_privacy", "logout_security"
] as const;
type Group = typeof GROUPS[number];
const group = process.env.MOBILE_FUZZ_GROUP as Group | undefined;
const groupIndex = group ? GROUPS.indexOf(group) : -1;
if (groupIndex < 0) throw new Error("MOBILE_FUZZ_GROUP must select an approved shard");

const EVALUATIONS = 1_000_000;
const seed = (0x87e02026 ^ Math.imul(groupIndex + 1, 0x9e3779b9)) >>> 0;
function* values(start: number): Generator<number> {
  let x = start || 1;
  for (let i = 0; i < EVALUATIONS; i++) {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    yield x >>> 0;
  }
}
const safeId = (x:unknown) => typeof x === "number" && Number.isSafeInteger(x) && x > 0;
const statusOptions = [...statuses, "INVALID"];
const priorityOptions = ["baixa","media","alta","critica","INVALID"];
const permissionOptions = [
  ["occurrences.view","occurrences.transition"], ["occurrences.view"],
  ["occurrences.transition"], [], ["occurrences.view","occurrences.transition","occurrences.close"]
];
const roles = ["agente","supervisor","despachador","administrador","coordenador"];

function rbac(v:number): boolean {
  const user = {
    id: [1, 2, 0, -1, 1.5, 9007199254740992][(v >>> 4) % 6],
    teamId: [1, 9, null, 0, -9, 1.5][(v >>> 7) % 6],
    active: (v & 1) === 0, operationalRole: roles[(v >>> 10) % roles.length],
    name: "synthetic"
  };
  const orgId = [1, 9, 0, -1, 1.5][(v >>> 13) % 5];
  const permissions = permissionOptions[(v >>> 16) % permissionOptions.length];
  const expected = user.active && user.operationalRole === "agente" &&
    safeId(user.id) && safeId(user.teamId) && safeId(orgId) &&
    permissions.includes("occurrences.view") && permissions.includes("occurrences.transition");
  return isFieldUser(user,{permissions},orgId) === expected;
}

function incidentContract(v:number): boolean {
  const mode = (v >>> 19) % 16;
  const incident:Record<string,unknown> = {
    id:(v % 100000) + 1, code:"OCO-"+(v % 100000),
    status:statusOptions[(v >>> 4) % 8], priority:priorityOptions[(v >>> 7) % 4],
    category:"Synthetic",description:"Synthetic record",address:"No real address",
    assignedTeamId:7,statusRevision:(v >>> 10) % 20
  };
  const rows:Array<{incident:Record<string,unknown>}> = [{incident}];
  if (mode===7) incident.assignedTeamId=8;
  if (mode===8) incident.id=0;
  if (mode===9) incident.code="X".repeat(121);
  if (mode===10) incident.status="INVALID";
  if (mode===11) incident.priority="INVALID";
  if (mode===12) incident.statusRevision=-1;
  if (mode===13) delete incident.category;
  if (mode===14) rows.push({incident:{...incident}});
  const payload={rows,total:mode===15 ? 0 : rows.length};
  let accepted=false;
  try { accepted=validateAssignmentResult(payload,7)===payload; } catch { accepted=false; }
  return accepted === (mode<7);
}

function sessionEpoch(v:number): boolean {
  const model=new SessionEpoch();
  const before=model.beginAuthentication();
  const mode=(v >>> 8) % 8;
  const rotations=(v & 15)+1;
  if(mode===0){
    for(let i=0;i<rotations;i++)if(model.changeScope()!==before)return false;
    return model.grant(before) && model.isOperational(before);
  }
  if(!model.grant(before) || !model.isOperational(before))return false;
  let current=before;
  for(let i=0;i<rotations;i++) {
    const old=current; current=model.changeScope();
    if(model.isOperational(old) || !model.isOperational(current))return false;
  }
  if(mode===1)return !model.grant(before);
  if(mode===2){
    model.revoke();
    return !model.isOperational(current) && !model.grant(current);
  }
  if(mode===3){
    const second=model.beginAuthentication(), third=model.beginAuthentication();
    return !model.grant(second) && model.grant(third) && !model.isOperational(current);
  }
  if(mode===4){
    model.revoke();
    const newTicket=model.beginAuthentication();
    return !model.isOperational(newTicket) && !model.grant(before) && model.grant(newTicket);
  }
  if(mode===5)return !model.isCurrent(before) && model.isCurrent(current);
  if(mode===6){
    const stale=current; model.changeScope();
    return !model.isOperational(stale) && !model.grant(stale);
  }
  model.beginAuthentication();
  return !model.isOperational(current);
}

function freshness(v:number): boolean {
  const now=1_700_000_000_000 + (v >>> 10);
  const offsets=[-60_000,-1,0,1,50,5_000,15_000,44_999,45_000,45_001,46_000,90_000,900_000];
  const age=offsets[v % offsets.length];
  const value=(v & 128)===0 ? now-age : (v & 256)===0 ? null : Number.NaN;
  const expected=typeof value==="number" && Number.isFinite(value) &&
    value>=0 && now>=value && now-value<=45_000;
  const obtained=isFieldSnapshotFresh(value,now);
  const summary=timeSinceVerification(value,now);
  return obtained===expected && (summary==="Sem validação recente")===!expected;
}

function lifecycle(v:number): boolean {
  const auth=Boolean(v&1),online=Boolean(v&2),foreground=Boolean(v&4),native=Boolean(v&8);
  const actual=shouldQueryLiveAssignments(auth,online,foreground,native);
  // Combine device state and server rejection classification in each scenario.
  const code=["401","403","UNAUTHORIZED","FORBIDDEN","SESSION_EXPIRED",
    "UNAUTHENTICATED","PERMISSION_DENIED","NETWORK_ERROR","TIMEOUT","INVALID_RESPONSE"][(v>>>7)%10];
  const revoked=isAccessRevoked(new ApiError("synthetic",code));
  const expectedRevocation=!["NETWORK_ERROR","TIMEOUT","INVALID_RESPONSE"].includes(code);
  return actual===(auth && online && foreground && !native) && revoked===expectedRevocation;
}

function gpsIntegrity(v:number): boolean {
  const now=1_700_000_000_000;
  const latitude=((v % 240001)-120000)/1000;
  const longitude=(((v>>>4) % 420001)-210000)/1000;
  const accuracy=((v>>>10)%801)-30;
  const ages=[-1000,-1,0,1,500,9999,20000,29999,30000,30001,90000][(v>>>17)%11];
  const fix={latitude,longitude,accuracy,timestamp:now-ages};
  const expected=latitude>=-90 && latitude<=90 && longitude>=-180 && longitude<=180 &&
    accuracy>=0 && accuracy<=250 && ages>=0 && ages<=30000;
  return validLocation(fix,now)===expected;
}

function gpsAntireplay(v:number): boolean {
  const now=1_700_000_000_000;
  const elapsed=(v % 70000)-1000;
  const age=(v>>>6)%40000;
  const mode=(v>>>12)%5;
  const fix={latitude:-27.3,longitude:-48.7,accuracy:20,timestamp:now-age};
  const lastAttempt=mode===0?null:now-elapsed;
  const lastFix=mode===1?null:mode===2?fix.timestamp:mode===3?fix.timestamp+1:fix.timestamp-1;
  const expected=age<=30000 &&
    (lastFix===null || fix.timestamp>lastFix) &&
    (lastAttempt===null || (lastAttempt>=0 && elapsed>=20000));
  if(shouldAttemptFreshLocation(lastAttempt,lastFix,fix,now)!==expected)return false;
  // Additional stateful ledger check for every eighth generated scenario.
  if((v&7)===0){
    const ledger=new GpsAttemptLedger();
    const first=ledger.beginAttempt(1,2,{...fix,timestamp:now},now);
    if(!first || ledger.beginAttempt(1,2,{...fix,timestamp:now},now+20000))return false;
    const newFix={...fix,timestamp:now+20000};
    if(!ledger.beginAttempt(1,2,newFix,now+20000))return false;
  }
  return true;
}

function store(){
  const map=new Map<string,string>();
  return {
    getItem:(key:string)=>map.get(key)??null,
    setItem:(key:string,value:string)=>{map.set(key,value);},
    removeItem:(key:string)=>{map.delete(key);},
    map
  };
}
function offlinePrivacy(v:number): boolean {
  const s=store();
  const scope={userId:1+(v%3000),organizationId:1+((v>>>5)%101),teamId:1+((v>>>12)%100)};
  const now=1_700_000_000_000;
  const mode=(v>>>19)%10;
  const row={id:1+(v%100000),code:"OCO-"+(v%100000),category:"Synthetic",status:"aceita",
    address:"SECRET_ADDRESS",description:"SECRET_DESCRIPTION",token:"SECRET_TOKEN"};
  saveLastAuthorizedAssignments(s,scope,[row],now);
  const key=agentOfflineKey(scope,"list");
  const original=s.getItem(key);
  if(!original || original.includes("SECRET"))return false;
  if(mode===3||mode===4||mode===5){
    const envelope=JSON.parse(original);
    if(mode===3)envelope.expiresAt++;
    if(mode===4)envelope.payload[0].status="unknown";
    if(mode===5)envelope.scope.organizationId++;
    s.setItem(key,JSON.stringify(envelope));
  }
  const readScope=mode===1?{...scope,teamId:scope.teamId+1}:scope;
  const readNow=mode===2?now+AGENT_OFFLINE_TTL_MS:now+1;
  const loaded=loadAuthorizedAssignmentSnapshot(s,readScope,readNow);
  const expected=![1,2,3,4,5].includes(mode);
  if(Boolean(loaded)!==expected)return false;
  if(loaded && (loaded.rows.length!==1 || loaded.rows[0].code!==row.code ||
      (loaded.rows[0] as Record<string,unknown>).address!==undefined))return false;
  // Notes are explicitly opt-in, scoped and non-networked.
  if(mode===8){
    const note="Nota sintética "+(v>>>3);
    saveAgentNoteDraft(s,scope,row.id,note,now);
    if(loadAgentNoteDraft(s,scope,row.id,now+1)!==note)return false;
    if(loadAgentNoteDraft(s,{...scope,userId:scope.userId+1},row.id,now+1)!==null)return false;
  }
  return true;
}

function logoutSecurity(v:number): boolean {
  const s=store();
  const mode=(v>>>5)%10;
  const marker=["","pending","bad-value","{}","0","unknown"][(v>>>15)%6];
  const code=["401","403","FORBIDDEN","UNAUTHORIZED","SESSION_EXPIRED",
    "PERMISSION_DENIED","NETWORK_ERROR","TIMEOUT"][(v>>>10)%8];
  const revoked=isAccessRevoked(new ApiError("synthetic",code));
  const expectedRevoked=!["NETWORK_ERROR","TIMEOUT"].includes(code);
  if(revoked!==expectedRevoked)return false;
  if(mode===0){
    if(hasPendingLogout(s))return false;
    markPendingLogout(s);
    if(!hasPendingLogout(s))return false;
    clearPendingLogout(s);
    return !hasPendingLogout(s);
  }
  if(mode===1||mode===2) {
    s.setItem(PENDING_LOGOUT_KEY,marker);
    return hasPendingLogout(s);
  }
  if(mode===3)return shouldRevokeForLogoutFenceEvent(PENDING_LOGOUT_KEY,marker);
  if(mode===4)return !shouldRevokeForLogoutFenceEvent(PENDING_LOGOUT_KEY,null);
  if(mode===5)return !shouldRevokeForLogoutFenceEvent("another-key",marker);
  if(mode===6){
    assertSessionFenceWritable(s);
    return !hasPendingLogout(s);
  }
  if(mode===7){
    const blocked={...s,setItem:(_k:string,_v:string)=>{}};
    try {assertSessionFenceWritable(blocked);return false;}catch{return true;}
  }
  if(mode===8){
    const blocked={...s,setItem:(_k:string,_v:string)=>{}};
    try {markPendingLogout(blocked);return false;}catch{return true;}
  }
  s.setItem(PENDING_LOGOUT_KEY,"pending");
  clearPendingLogout(s);
  return !hasPendingLogout(s);
}
const syncChecks:Record<Exclude<Group,"team_snapshot">,(v:number)=>boolean>={
  rbac, incident_contract:incidentContract, session_epoch:sessionEpoch,
  freshness, lifecycle, gps_integrity:gpsIntegrity, gps_antireplay:gpsAntireplay,
  offline_privacy:offlinePrivacy, logout_security:logoutSecurity
};

async function teamSnapshot(v:number):Promise<boolean> {
  const mode=(v>>>16)%10, id=1+(v%100000);
  const make=(itemId:number,state:string,team=7,revision=1)=>({
    incident:{id:itemId,code:"OCO-"+itemId,status:state,priority:"media",
      category:"Synthetic",address:"No real address",description:"Synthetic",
      assignedTeamId:team,statusRevision:revision}
  });
  const active=make(id,"aceita");
  const history=mode===5?Array.from({length:50},(_,i)=>make(id+1+i,"concluida")):[];
  let main={rows:mode===0?[]:mode===5?history:[active],total:mode===0?0:mode===5?51:1};
  let filtered:unknown=mode===0?{rows:[],total:0}:{rows:[active],total:1};
  if(mode===2)filtered={rows:[],total:0};
  if(mode===3)filtered={rows:[active,active],total:2};
  if(mode===4)filtered={rows:[make(id,"aceita",8)],total:1};
  if(mode===6)filtered={rows:[active],total:2};
  if(mode===8)main={rows:[make(id,"UNKNOWN")],total:1};
  if(mode===9)filtered={rows:[make(id,"aceita",7,2)],total:1};
  const controller=new AbortController();
  if(mode===7)controller.abort();
  const fetchAssignments=async(status?:string)=>{
    if(status==="aceita")return filtered;
    if(status==="em_atendimento"||status==="pausada")return {rows:[],total:0};
    return main;
  };
  let passed=false;
  try {
    const snapshot=await loadVerifiedTeamSnapshot(7,fetchAssignments,controller.signal);
    passed=snapshot.activeCount===(mode===0?0:1) &&
      snapshot.total===main.total && (mode===0||snapshot.rows.some(r=>r.incident.id===id));
  }catch {passed=false;}
  return passed === (mode===0||mode===1||mode===5);
}

describe("AXE Despacho Mobile — one-million verified scenarios per selected shard",()=>{
  it("validates one million deterministic policy evaluations with fail-fast oracle",async()=>{
    let count=0;
    let fingerprint=0x811c9dc5;
    const fn=group==="team_snapshot"?null:syncChecks[group as Exclude<Group,"team_snapshot">];
    for(const v of values(seed)){
      const ok=group==="team_snapshot" ? await teamSnapshot(v) : fn!(v);
      if(ok!==true)throw new Error(
        "SCENARIO_FAILED group="+group+" index="+count+" seed="+seed+" random="+v
      );
      fingerprint=Math.imul(fingerprint^v,16777619)>>>0;
      count++;
    }
    expect(count).toBe(EVALUATIONS);
    const receipt={
      schema_version:1, group, seed, evaluations:count, failures:0,
      fingerprint: fingerprint.toString(16).padStart(8,"0"),
      evidence_type:"synthetic_policy_checks",
      real_environment_homologation:false,
      production_approved:false
    };
    mkdirSync("artifacts/ten-million",{recursive:true});
    writeFileSync("artifacts/ten-million/receipt-"+group+".json",
      JSON.stringify(receipt,null,2)+"\n","utf8");
    console.log("MOBILE_10M_SHARD_PASS "+JSON.stringify(receipt));
  },300_000);
});
