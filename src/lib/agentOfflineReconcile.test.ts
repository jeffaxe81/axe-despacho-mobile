import {describe,expect,it} from "vitest";
import {compareAgentOfflineAssignments} from "./agentOfflineReconcile";
const assignment=(id:number,status:string,code="OCO-"+id)=>({id,code,category:"Vistoria",status});
describe("AXED-F046 — conferência manual de snapshot com servidor",()=>{
  it("identifica status alterado, atribuição removida e atribuição adicionada",()=>{
    const result=compareAgentOfflineAssignments([assignment(1,"despachada"),assignment(2,"aceita")],
      [assignment(1,"em_atendimento"),assignment(3,"despachada")]);
    expect(result).toMatchObject({changed:1,removed:1,added:1,unchanged:0});
    expect(result.differences).toEqual(expect.arrayContaining([
      expect.objectContaining({id:1,kind:"changed",previousStatus:"despachada",currentStatus:"em_atendimento"}),
      expect.objectContaining({id:2,kind:"removed"}),
      expect.objectContaining({id:3,kind:"added"}),
    ]));
  });
  it("sinaliza inalterado sem propor nenhuma mutação",()=>{
    const result=compareAgentOfflineAssignments([assignment(1,"aceita")],[assignment(1,"aceita")]);
    expect(result).toEqual({changed:0,removed:0,added:0,unchanged:1,differences:[]});
  });
  it("falha fechado com identificadores duplicados ou inválidos",()=>{
    expect(()=>compareAgentOfflineAssignments([assignment(1,"aceita"),assignment(1,"pausada")],[])).toThrow(/inconsistente/);
    expect(()=>compareAgentOfflineAssignments([], [assignment(0,"aceita")])).toThrow(/inconsistente/);
    expect(()=>compareAgentOfflineAssignments(new Array(51).fill(assignment(1,"aceita")),[])).toThrow(/Limite/);
  });
  it("rejeita projeções com endereço/PII mesmo se o resultado não os exibiria",()=>{
    const full={...assignment(1,"aceita"),address:"DADO NÃO AUTORIZADO",description:"PRIVADO"};
    expect(()=>compareAgentOfflineAssignments([full],[assignment(1,"pausada")])).toThrow(/inconsistente/);
  });
  it.each([
    {status:"__not_a_real_status__"},
    {code:"OCO-1\nCONTACT: SECRET"},
    {code:"/" },
    {category:"x\u0000y"},
  ])("rejeita resumo com campos fora do contrato: %j",patch=>{
    expect(()=>compareAgentOfflineAssignments([{...assignment(1,"aceita"),...patch}],[])).toThrow(/inconsistente/);
  });
});
