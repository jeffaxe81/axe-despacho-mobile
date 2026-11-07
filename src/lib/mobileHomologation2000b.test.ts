import { describe, expect, it } from "vitest";
import { GpsAttemptLedger } from "./gpsAttemptLedger";
import { AGENT_OFFLINE_TTL_MS, agentOfflineKey, loadAuthorizedAssignmentSnapshot,
  saveLastAuthorizedAssignments, saveAgentNoteDraft, loadAgentNoteDraft, deleteAgentNoteDraft
} from "./agentOffline";
import { PENDING_LOGOUT_KEY, assertSessionFenceWritable, markPendingLogout,
  hasPendingLogout, clearPendingLogout, shouldRevokeForLogoutFenceEvent
} from "./sessionFence";
import { isFieldSnapshotFresh, shouldQueryLiveAssignments, timeSinceVerification,
  FIELD_SNAPSHOT_MAX_AGE_MS } from "./clientFreshness";
import { isAccessRevoked } from "./sessionAccess";
import { ApiError } from "./api";

/**
 * Mobile pre-homologation suite B: 1,000 independently named synthetic cases.
 * Five production-facing policies × 200. Uses in-memory fixtures only.
 * These are NOT field/device/E2E or real backend homologation gates.
 */
const delays=[
  0,1,10,100,1000,9999,19998,19999,20000,20001,
  25000,29999,30000,30001,45000,60000,120000,300000,5,15000
];
const attemptModes=[
  "same-fix","fresh-fix","old-replay","other-org","other-team",
  "invalid-org","invalid-team","imprecise","future-fix","stale-fix"
] as const;
const attemptCases=attemptModes.flatMap((mode,mi)=>delays.map((delay,di)=>({
  label:`F/gps-retry-${mi}-${di}`,mode,delay
})));
if(attemptCases.length!==200)throw new Error("Expected 200 GPS ledger cases");
const location=(timestamp:number,accuracy=10)=>({
  latitude:-27.5,longitude:-48.5,accuracy,timestamp
});

describe("Homologation F: 200 GPS no-replay, retry, isolation and rate-limit cases",()=>{
  it.each(attemptCases)("$label",({mode,delay})=>{
    const ledger=new GpsAttemptLedger();
    const now=1_000_000;
    expect(ledger.beginAttempt(4,7,location(now),now)).toBe(true);
    const nextAt=now+delay;
    const scopeOrg=mode==="other-org"?5:mode==="invalid-org"?0:4;
    const scopeTeam=mode==="other-team"?8:mode==="invalid-team"?0:7;
    const sample=mode==="same-fix"||mode==="old-replay"||
      mode==="other-org"||mode==="other-team"
      ? location(now)
      : mode==="imprecise" ? location(nextAt,501)
      : mode==="future-fix" ? location(nextAt+1)
      : mode==="stale-fix" ? location(nextAt-30_001)
      : location(nextAt);
    const expected=mode==="fresh-fix" ? delay>=20_000 :
      (mode==="other-org"||mode==="other-team") ? delay<=30_000 : false;
    expect(ledger.beginAttempt(scopeOrg,scopeTeam,sample,nextAt)).toBe(expected);
    if(expected)expect(ledger.beginAttempt(scopeOrg,scopeTeam,sample,nextAt+1)).toBe(false);
  });
});

function storage(){
  const map=new Map<string,string>();
  return {
    getItem:(key:string)=>map.get(key)??null,
    setItem:(key:string,value:string)=>{map.set(key,value);},
    removeItem:(key:string)=>{map.delete(key);},
    map
  };
}
const scope={userId:19,organizationId:4,teamId:7};
const ages=[
  0,1,10,100,500,1000,15000,60000,120000,300000,
  600000,899998,899999,900000,900001,1200000,1500000,42,450000,750000
];
const cacheModes=[
  "clean","redacted","wrong-user","wrong-org","wrong-team","modified-ttl",
  "invalid-status","modified-scope","modified-version","oversized"
] as const;
const cacheCases=cacheModes.flatMap((mode,mi)=>ages.map((age,ai)=>({
  label:`G/offline-${mi}-${ai}`,mode,age
})));
if(cacheCases.length!==200)throw new Error("Expected 200 offline/cache cases");

describe("Homologation G: 200 offline privacy, expiry and tampering cases",()=>{
  it.each(cacheCases)("$label",({mode,age})=>{
    const s=storage();
    const now=1_000_000;
    const input=[{id:100,code:"INC-100",category:"Resgate",status:"aceita",
      address:"PRIVATE_ADDRESS",description:"PRIVATE_DESCRIPTION",token:"PRIVATE_TOKEN"}];
    saveLastAuthorizedAssignments(s,scope,input,now);
    const key=agentOfflineKey(scope,"list");
    expect(s.getItem(key)).not.toContain("PRIVATE_ADDRESS");
    expect(s.getItem(key)).not.toContain("PRIVATE_DESCRIPTION");
    expect(s.getItem(key)).not.toContain("PRIVATE_TOKEN");
    if(mode==="oversized")s.setItem(key,"X".repeat(20_001));
    if(["modified-ttl","invalid-status","modified-scope","modified-version"].includes(mode)){
      const envelope=JSON.parse(s.getItem(key)!) as {
        version:number; expiresAt:number;scope:typeof scope;payload:{status:string}[]
      };
      if(mode==="modified-ttl")envelope.expiresAt++;
      if(mode==="invalid-status")envelope.payload[0].status="untrusted";
      if(mode==="modified-scope")envelope.scope.teamId=999;
      if(mode==="modified-version")envelope.version=2;
      s.setItem(key,JSON.stringify(envelope));
    }
    const readScope=mode==="wrong-user"?{...scope,userId:20}:
      mode==="wrong-org"?{...scope,organizationId:5}:
      mode==="wrong-team"?{...scope,teamId:8}:scope;
    const result=loadAuthorizedAssignmentSnapshot(s,readScope,now+age);
    const allowed=(mode==="clean"||mode==="redacted") && age<AGENT_OFFLINE_TTL_MS;
    expect(result!==null).toBe(allowed);
    if(allowed){
      expect(result!.rows).toEqual([{id:100,code:"INC-100",category:"Resgate",status:"aceita"}]);
      expect(result!.expiresAt).toBe(now+AGENT_OFFLINE_TTL_MS);
    }
  });
});

const noteModes=[
  "normal","unicode","max-length","spaces-only","two-characters",
  "too-long","empty","whitespace-surround","exact-min","not-a-string"
] as const;
const noteCases=noteModes.flatMap((mode,mi)=>Array.from({length:20},(_,i)=>({
  label:`H/note-${mi}-${i}`,mode,incidentId:i+1
})));
if(noteCases.length!==200)throw new Error("Expected 200 note cases");

describe("Homologation H: 200 offline note bounds, isolation and removal cases",()=>{
  it.each(noteCases)("$label",({mode,incidentId})=>{
    const s=storage();
    const now=3_000_000;
    const note=mode==="normal"?`Ação realizada ${incidentId}`:
      mode==="unicode"?`Equipe 🚑 ocorrência ${incidentId}`:
      mode==="max-length"?"A".repeat(1000):
      mode==="spaces-only"?"   ":
      mode==="two-characters"?"ab":
      mode==="too-long"?"A".repeat(1001):
      mode==="empty"?"":
      mode==="whitespace-surround"?"  abc  ":
      mode==="exact-min"?"abc":null;
    const allowed=["normal","unicode","max-length","whitespace-surround","exact-min"].includes(mode);
    if(!allowed){
      expect(()=>saveAgentNoteDraft(s,scope,incidentId,note as string,now)).toThrow();
      expect(loadAgentNoteDraft(s,scope,incidentId,now+1)).toBeNull();
      return;
    }
    saveAgentNoteDraft(s,scope,incidentId,note!,now);
    expect(loadAgentNoteDraft(s,scope,incidentId,now+1)).toBe(note);
    expect(loadAgentNoteDraft(s,scope,incidentId+1000,now+1)).toBeNull();
    expect(loadAgentNoteDraft(s,{...scope,teamId:8},incidentId,now+1)).toBeNull();
    expect(loadAgentNoteDraft(s,scope,incidentId,now+AGENT_OFFLINE_TTL_MS)).toBeNull();
    saveAgentNoteDraft(s,scope,incidentId,note!,now);
    deleteAgentNoteDraft(s,scope,incidentId);
    expect(loadAgentNoteDraft(s,scope,incidentId,now+1)).toBeNull();
  });
});

const markers=Array.from({length:20},(_,i)=>[
  "", "pending", "corrupted", "0", "false", "null", "[]", "{}", "   ", "1",
  "logout", "revoked", "\u0000", "awaiting", "nonce", "legacy", "-", "TRUE", "PENDING", "bad-key"
][i]);
const fenceModes=[
  "mark-and-clear","existing-marker","corrupted-marker","same-key-event",
  "other-key-event","removal-event","restore-probe","empty-probe",
  "unwritable-probe","unwritable-marker"
] as const;
const fenceCases=fenceModes.flatMap((mode,mi)=>markers.map((marker,idx)=>({
  label:`I/logout-${mi}-${idx}`,mode,marker
})));
if(fenceCases.length!==200)throw new Error("Expected 200 logout fence cases");

describe("Homologation I: 200 logout cross-tab fences and corrupted storage cases",()=>{
  it.each(fenceCases)("$label",({mode,marker})=>{
    const s=storage();
    if(mode==="mark-and-clear"){
      expect(hasPendingLogout(s)).toBe(false);
      assertSessionFenceWritable(s);
      markPendingLogout(s);
      expect(hasPendingLogout(s)).toBe(true);
      clearPendingLogout(s);
      expect(hasPendingLogout(s)).toBe(false);
    }else if(mode==="existing-marker"||mode==="corrupted-marker"){
      s.setItem(PENDING_LOGOUT_KEY,mode==="corrupted-marker"?marker+"X":marker);
      expect(hasPendingLogout(s)).toBe(true); // even an empty/corrupted marker is a fence
    }else if(mode==="same-key-event"){
      expect(shouldRevokeForLogoutFenceEvent(PENDING_LOGOUT_KEY,marker)).toBe(true);
    }else if(mode==="other-key-event"){
      expect(shouldRevokeForLogoutFenceEvent("another.key",marker)).toBe(false);
    }else if(mode==="removal-event"){
      expect(shouldRevokeForLogoutFenceEvent(PENDING_LOGOUT_KEY,null)).toBe(false);
    }else if(mode==="restore-probe"){
      const key="dispatch.mobile.fenceProbe.v1";
      s.setItem(key,marker);
      assertSessionFenceWritable(s);
      expect(s.getItem(key)).toBe(marker);
    }else if(mode==="empty-probe"){
      assertSessionFenceWritable(s);
      expect(s.getItem("dispatch.mobile.fenceProbe.v1")).toBeNull();
    }else if(mode==="unwritable-probe"){
      const blocked={getItem:s.getItem,setItem:(_key:string,_value:string)=>{},removeItem:s.removeItem};
      expect(()=>assertSessionFenceWritable(blocked)).toThrow();
    }else if(mode==="unwritable-marker"){
      const blocked={getItem:s.getItem,setItem:(_key:string,_value:string)=>{},removeItem:s.removeItem};
      expect(()=>markPendingLogout(blocked)).toThrow();
    }
  });
});

const errors=[
  "401","403","FORBIDDEN","UNAUTHORIZED","UNAUTHENTICATED",
  "SESSION_EXPIRED","PERMISSION_DENIED","NETWORK_ERROR","TIMEOUT","INVALID_RESPONSE"
];
const lifecycle=[
  {auth:true,online:true,foreground:true,native:false},
  {auth:false,online:true,foreground:true,native:false},
  {auth:true,online:false,foreground:true,native:false},
  {auth:true,online:true,foreground:false,native:false},
  {auth:true,online:true,foreground:true,native:true}
];
const stateAges=[0,45_000,45_001,-1];
const connectivityCases=errors.flatMap((code,ci)=>lifecycle.flatMap((s,si)=>stateAges.map((age,ai)=>({
  label:`J/network-${ci}-${si}-${ai}`,code,s,age,ci
}))));
if(connectivityCases.length!==200)throw new Error("Expected 200 connectivity cases");

describe("Homologation J: 200 network, foreground, native and revocation cases",()=>{
  it.each(connectivityCases)("$label",({code,s,age,ci})=>{
    const now=2_000_000;
    const canPoll=s.auth&&s.online&&s.foreground&&!s.native;
    const fresh=age>=0&&age<=FIELD_SNAPSHOT_MAX_AGE_MS;
    const revoked=ci<7;
    expect(shouldQueryLiveAssignments(s.auth,s.online,s.foreground,s.native)).toBe(canPoll);
    expect(isFieldSnapshotFresh(now-age,now)).toBe(fresh);
    expect(timeSinceVerification(now-age,now)==="Sem validação recente").toBe(!fresh);
    expect(isAccessRevoked(new ApiError("Simulated response",code))).toBe(revoked);
  });
});
