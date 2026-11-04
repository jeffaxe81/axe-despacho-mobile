import {describe,expect,it} from "vitest";
import {activeAssigned,isFieldUser,statuses} from "./contracts";
describe("field scope and command gating",()=>{
  it("requires a valid active agent, tenant and server permissions",()=>{
    const user={id:2,name:"Agente",operationalRole:"agente",teamId:4,active:true};
    const access={permissions:["occurrences.view","occurrences.transition"]};
    expect(isFieldUser(user,access,1)).toBe(true);
    expect(isFieldUser({...user,teamId:null},access,1)).toBe(false);
    expect(isFieldUser(user,access,null)).toBe(false);
    expect(isFieldUser(user,{permissions:["occurrences.view"]},1)).toBe(false);
  });
  it("does not infer a field agent assignment from incident ownership",()=>{
    const incident={id:4,code:"OCO-4",status:"aceita" as const,priority:"alta" as const,category:"Resgate",address:"Rua",description:"Teste",assignedTeamId:3};
    const rows=[{incident},{incident:{...incident,id:5,status:"despachada" as const}}];
    expect(activeAssigned(rows)).toHaveLength(1);
    expect(statuses).toContain("pausada");
  });
});
