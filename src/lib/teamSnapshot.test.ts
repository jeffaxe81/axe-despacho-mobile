import { describe, expect, it, vi } from "vitest";
import { loadVerifiedTeamSnapshot } from "./teamSnapshot";
import type { FieldActiveStatus } from "./teamSnapshot";

const teamId=9;
type State="despachada"|"aceita"|"em_atendimento"|"pausada"|"concluida";
const incident=(id:number,status:State,revision=0)=>({
  incident:{id,code:"OCO-"+id,status,priority:"alta",category:"Teste",
    address:"Rua Exemplo",description:"Ocorrência sintética",
    assignedTeamId:teamId,statusRevision:revision}
});
const page=(rows:ReturnType<typeof incident>[],total=rows.length)=>({rows,total});
const empty=()=>page([]);
function reader(
  main:unknown,
  active:Partial<Record<FieldActiveStatus,unknown>>={}
){
  const mock=vi.fn(async(status?:FieldActiveStatus)=>{
    if(!status)return main;
    return active[status]??empty();
  });
  return mock;
}
describe("team snapshot: field safety across the first-page boundary",()=>{
  it("allows an empty team and checks all three active states",async()=>{
    const fetchPage=reader(empty());
    const snapshot=await loadVerifiedTeamSnapshot(teamId,fetchPage);
    expect(snapshot).toEqual({rows:[],total:0,activeCount:0});
    expect(fetchPage.mock.calls.length).toBe(4);
    expect(fetchPage.mock.calls.map(call=>call[0])).toEqual([
      undefined,"aceita","em_atendimento","pausada"
    ]);
  });
  it("confirms one active incident in the visible first page",async()=>{
    const active=incident(1,"em_atendimento");
    const snapshot=await loadVerifiedTeamSnapshot(teamId,reader(page([active]),{
      em_atendimento:page([active])
    }));
    expect(snapshot.activeCount).toBe(1);
    expect(snapshot.rows).toEqual([active]);
  });
  it("finds an active assignment hidden beyond 50 historical incidents",async()=>{
    const history=Array.from({length:50},(_,i)=>incident(i+1,"concluida"));
    const live=incident(100,"aceita");
    const snapshot=await loadVerifiedTeamSnapshot(teamId,reader(page(history,51),{
      aceita:page([live])
    }));
    expect(snapshot.activeCount).toBe(1);
    expect(snapshot.rows[0]).toEqual(live);
    expect(snapshot.rows).toHaveLength(51);
    expect(snapshot.total).toBe(51);
  });
  it("identifies conflict even when BOTH active incidents are beyond page one",async()=>{
    const history=Array.from({length:50},(_,i)=>incident(i+1,"concluida"));
    const snapshot=await loadVerifiedTeamSnapshot(teamId,reader(page(history,52),{
      aceita:page([incident(100,"aceita")]),
      pausada:page([incident(101,"pausada")])
    }));
    expect(snapshot.activeCount).toBe(2);
    expect(snapshot.rows.slice(0,2).map(r=>r.incident.id)).toEqual([100,101]);
  });
  it("rejects an active status that the central forgot to include in the filtered query",async()=>{
    await expect(loadVerifiedTeamSnapshot(teamId,reader(page([incident(1,"aceita")]))))
      .rejects.toMatchObject({code:"INCONSISTENT_TEAM_SNAPSHOT"});
  });
  it("rejects a filtered page with a different status",async()=>{
    await expect(loadVerifiedTeamSnapshot(teamId,reader(page([incident(1,"aceita")]),{
      aceita:page([incident(1,"pausada")])
    }))).rejects.toMatchObject({code:"INCONSISTENT_TEAM_SNAPSHOT"});
  });
  it("rejects changing revision/status during simultaneous reads",async()=>{
    await expect(loadVerifiedTeamSnapshot(teamId,reader(page([incident(1,"aceita",4)]),{
      aceita:page([incident(1,"aceita",5)])
    }))).rejects.toMatchObject({code:"INCONSISTENT_TEAM_SNAPSHOT"});
  });
  it("rejects a short filtered result despite positive total",async()=>{
    await expect(loadVerifiedTeamSnapshot(teamId,reader(page([incident(1,"despachada")]),{
      em_atendimento:page([],1)
    }))).rejects.toMatchObject({code:"INCONSISTENT_TEAM_SNAPSHOT"});
  });
  it("rejects cross-team data in any filtered page",async()=>{
    const wrong=incident(1,"pausada");
    wrong.incident.assignedTeamId=10;
    await expect(loadVerifiedTeamSnapshot(teamId,reader(empty(),{
      pausada:page([wrong])
    }))).rejects.toMatchObject({code:"TEAM_SCOPE_MISMATCH"});
  });
  it("fails closed if one status request fails rather than using cached totals",async()=>{
    const fetchPage=vi.fn(async(status?:FieldActiveStatus)=>{
      if(status==="pausada")throw new Error("Network timeout");
      return empty();
    });
    await expect(loadVerifiedTeamSnapshot(teamId,fetchPage)).rejects.toThrow("Network timeout");
  });
  it("does not send any request after an already cancelled switch of team",async()=>{
    const controller=new AbortController();
    controller.abort();
    const fetchPage=reader(empty());
    await expect(loadVerifiedTeamSnapshot(teamId,fetchPage,controller.signal))
      .rejects.toMatchObject({code:"ABORTED"});
    expect(fetchPage).not.toHaveBeenCalled();
  });
  it("does not enable a result if cancellation occurs while fetching",async()=>{
    const controller=new AbortController();
    const fetchPage=vi.fn(async()=>{controller.abort();return empty();});
    await expect(loadVerifiedTeamSnapshot(teamId,fetchPage,controller.signal))
      .rejects.toMatchObject({code:"ABORTED"});
  });
  it("deduplicates an active result already visible in the main page",async()=>{
    const row=incident(5,"aceita");
    const snapshot=await loadVerifiedTeamSnapshot(teamId,reader(page([row]),{aceita:page([row])}));
    expect(snapshot.rows).toHaveLength(1);
  });
  it("rejects repeated IDs across filtered statuses",async()=>{
    await expect(loadVerifiedTeamSnapshot(teamId,reader(empty(),{
      aceita:page([incident(5,"aceita")]),
      pausada:page([incident(5,"pausada")])
    }))).rejects.toMatchObject({code:"INCONSISTENT_TEAM_SNAPSHOT"});
  });
  it("requires the agent's valid team id",async()=>{
    await expect(loadVerifiedTeamSnapshot(null,reader(empty())))
      .rejects.toMatchObject({code:"INVALID_ASSIGNMENTS"});
  });
});
