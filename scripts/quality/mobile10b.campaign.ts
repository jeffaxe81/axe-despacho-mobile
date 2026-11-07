import { describe, expect, it } from "vitest";
import { mkdirSync,writeFileSync } from "node:fs";
import { isFieldUser,statuses, type FieldUser, type AssignmentRow } from "../../src/lib/contracts";
import { validLocation,shouldAttemptFreshLocation } from "../../src/lib/gpsAttemptLedger";
import { isFieldSnapshotFresh,shouldQueryLiveAssignments } from "../../src/lib/clientFreshness";
import { filterLoadedAssignments,type AssignmentViewFilter } from "../../src/lib/assignmentSearch";
import { validateAssignmentResult } from "../../src/lib/assignmentValidation";
import { SessionEpoch } from "../../src/lib/sessionEpoch";
import { agentOfflineKey,saveLastAuthorizedAssignments,loadAuthorizedAssignmentSnapshot } from "../../src/lib/agentOffline";
import { shouldRevokeForLogoutFenceEvent,markPendingLogout,clearPendingLogout,hasPendingLogout,PENDING_LOGOUT_KEY } from "../../src/lib/sessionFence";

/**
 * Bounded-memory, auditable MOBILE half of a 10-billion synthetic evaluation
 * campaign. Fifty 100M-evaluation CI shards = 5B MOBILE policy evaluations.
 * The backend repo runs the OTHER 5B; NEVER claim cross-repo completion based
 * only on this workflow. One Vitest item per shard, NOT 5B distinct test items.
 *
 * Each counted evaluation calls a real production module function and checks
 * an independent oracle. Deeper validations execute periodically. Synthetic
 * inputs can repeat. No phones, API servers or production data are touched.
 */
const GROUPS=["rbac","gps_validity","gps_antireplay","sync_freshness",
  "network_lifecycle","assignment_search","assignment_contract",
  "session_epoch","offline_scope","logout_fence"] as const;
type Group=typeof GROUPS[number];
const group=process.env.CAMPAIGN_GROUP as Group|undefined;
const groupIndex=GROUPS.indexOf(group as Group);
const partition=Number(process.env.CAMPAIGN_PARTITION??"NaN");
const count=Number(process.env.CAMPAIGN_ITERATIONS??"NaN");
if(groupIndex<0 || !Number.isInteger(partition)||partition<0||partition>4 ||
   ![100_000,100_000_000].includes(count)){
  throw new Error("Invalid 10B campaign group, partition or approved iteration budget");
}
const mode=count===100_000_000?"full":"smoke";
const seed=(0x6d2b2026 ^ Math.imul(groupIndex+1,0x9e3779b9) ^ Math.imul(partition+1,0x85ebca6b))>>>0;
let state=seed||1;
function next(){state^=state<<13;state^=state>>>17;state^=state<<5;return state>>>0;}
const now=1_700_000_000_000;
const user:FieldUser={id:7,name:"fixture",teamId:4,active:true,operationalRole:"agente"};
const perms={permissions:["occurrences.view","occurrences.transition"]};
const fix={latitude:-27.4,longitude:-48.6,accuracy:20,timestamp:now};
const viewNames:AssignmentViewFilter[]=["all","dispatched","active","finished"];
const sample:AssignmentRow[]=[{incident:{id:101,code:"OCO-101",category:"Resgate",status:"aceita",priority:"alta",address:"RESTRICTED",description:"SENSITIVE",assignedTeamId:4}}];
const page={rows:sample,total:1};
const epoch=new SessionEpoch();
const original=epoch.beginAuthentication();
if(!epoch.grant(original))throw new Error("Cannot initialize session epoch");
let sessionTicket=original;
const scope={userId:7,organizationId:2,teamId:4};
const offline={
  map:new Map<string,string>(),
  getItem(key:string){return this.map.get(key)??null;},
  setItem(key:string,value:string){this.map.set(key,value);},
  removeItem(key:string){this.map.delete(key);}
};

function check(group:Group,x:number,i:number):boolean{
  switch(group){
  case "rbac": {
    user.active=(x&1)===0;
    user.operationalRole=(x&2)===0?"agente":"supervisor";
    user.teamId=(x&4)===0?4:0;
    const access=(x&8)===0?perms:{permissions:["occurrences.view"]};
    const org=(x&16)===0?2:null;
    const expected=user.active&&user.operationalRole==="agente"&&user.teamId===4&&
      access===perms&&org===2;
    return isFieldUser(user,access,org)===expected;
  }
  case "gps_validity": {
    fix.latitude=(x%243)-121;fix.longitude=((x>>>8)%423)-211;
    fix.accuracy=((x>>>17)%602)-1;
    const age=((x>>>5)%40_002)-1;
    fix.timestamp=now-age;
    const expected=Math.abs(fix.latitude)<=90 && Math.abs(fix.longitude)<=180 &&
      fix.accuracy>=0 && fix.accuracy<=500 && age>=0 && age<=30_000;
    return validLocation(fix,now)===expected;
  }
  case "gps_antireplay": {
    fix.latitude=-27.4;fix.longitude=-48.6;fix.accuracy=10;
    const age=x%40_000;
    fix.timestamp=now-age;
    const lastAt=(x&1)===0?null:now-((x>>>8)%40_000);
    const lastFix=(x&2)===0?null:fix.timestamp+(((x>>>16)%3)-1);
    const expected=age<=30_000&&(lastFix===null||fix.timestamp>lastFix)&&
      (lastAt===null||now-lastAt>=20_000);
    return shouldAttemptFreshLocation(lastAt,lastFix,fix,now)===expected;
  }
  case "sync_freshness": {
    const age=(x%90_002)-1;
    const verified=(x&8)===0?null:now-age;
    const expected=verified!==null&&age>=0&&age<=45_000;
    return isFieldSnapshotFresh(verified,now)===expected;
  }
  case "network_lifecycle": {
    const a=!!(x&1),b=!!(x&2),c=!!(x&4),n=!!(x&8);
    return shouldQueryLiveAssignments(a,b,c,n)===(a&&b&&c&&!n);
  }
  case "assignment_search": {
    const view=viewNames[x%viewNames.length];
    const query=(x&4)===0?"":"resgate";
    const status=statuses[(x>>>9)%statuses.length];
    sample[0].incident.status=status;
    const rows=filterLoadedAssignments(sample,query,view);
    const allowed=view==="all"||view==="dispatched"&&status==="despachada"||
      view==="active"&&["aceita","em_atendimento","pausada"].includes(status)||
      view==="finished"&&["concluida","cancelada"].includes(status);
    return rows.length===(allowed?1:0) && (rows.length===0||rows[0]===sample[0]);
  }
  case "assignment_contract": {
    sample[0].incident.status=statuses[x%statuses.length];
    sample[0].incident.priority=(x&1)===0?"alta":"baixa";
    sample[0].incident.assignedTeamId=4;
    page.total=1;
    // Deep hostile responses are checked occasionally; the hot path checks the
    // actual entire production contract, including code, team and pagination.
    if((i&65_535)===0){
      sample[0].incident.assignedTeamId=5;
      try{validateAssignmentResult(page,4);return false;}catch{/* fail closed */}
      sample[0].incident.assignedTeamId=4;
    }
    return validateAssignmentResult(page,4)===page;
  }
  case "session_epoch": {
    if((i&4095)===0){
      const expired=sessionTicket;
      sessionTicket=epoch.changeScope();
      if(epoch.isOperational(expired))return false;
    }
    return epoch.isOperational(sessionTicket)===true;
  }
  case "offline_scope": {
    scope.userId=1+(x%800);
    scope.teamId=1+((x>>>12)%500);
    const key=agentOfflineKey(scope,"list");
    if(!key.startsWith("dispatch.offline.agent.v1." + scope.userId + ".2." + scope.teamId + ".list"))return false;
    if((i&65_535)===0){
      const rows=[{id:51,code:"INC-51",category:"Fixture",status:"aceita"}];
      saveLastAuthorizedAssignments(offline,scope,rows,now);
      const read=loadAuthorizedAssignmentSnapshot(offline,scope,now+1);
      if(read?.rows[0]?.code!=="INC-51" || loadAuthorizedAssignmentSnapshot(offline,{...scope,teamId:scope.teamId+1},now+1)!==null)return false;
      offline.map.clear();
    }
    return true;
  }
  case "logout_fence": {
    const key=(x&1)===0?PENDING_LOGOUT_KEY:(x&2)===0?"unrelated":null;
    const value=(x&4)===0?"pending":null;
    const expected=key===null||(key===PENDING_LOGOUT_KEY&&value!==null);
    if(shouldRevokeForLogoutFenceEvent(key,value)!==expected)return false;
    if((i&65_535)===0){
      markPendingLogout(offline);
      if(!hasPendingLogout(offline))return false;
      clearPendingLogout(offline);
      if(hasPendingLogout(offline))return false;
    }
    return true;
  }
  }
}

describe("AXE Despacho Mobile — audited large-scale synthetic policy campaign",()=>{
  it("evaluates the configured partition and creates a count-verified receipt",()=>{
    let checks=0;
    let fingerprint=2166136261>>>0;
    for(let i=0;i<count;i++){
      const x=next();
      if(!check(group!,x,i)){
        throw new Error("CAMPAIGN_MISMATCH group="+group+" partition="+partition+
          " iteration="+i+" seed="+seed+" input="+x);
      }
      fingerprint=Math.imul(fingerprint^x,16777619)>>>0;
      checks++;
    }
    expect(checks).toBe(count);
    const receipt={
      schema:1,repo:"jeffaxe81/axe-despacho-mobile",mode,group,partition,seed,
      evaluations:checks,failures:0,fingerprint:fingerprint.toString(16).padStart(8,"0"),
      commit:process.env.GITHUB_SHA??"local",
      evidence_type:"synthetic_policy_evaluations",
      unique_cases_guaranteed:false,
      real_environment_homologation:false,production_approved:false
    };
    mkdirSync("artifacts/campaign-10b",{recursive:true});
    writeFileSync("artifacts/campaign-10b/mobile-"+group+"-"+partition+".json",JSON.stringify(receipt,null,2)+"\n");
    console.log("MOBILE_10B_SHARD_PASS "+JSON.stringify(receipt));
  },900_000);
});
