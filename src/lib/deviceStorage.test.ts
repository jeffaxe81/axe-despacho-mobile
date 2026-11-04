import {describe,it,expect} from "vitest";
import {clearFieldCache,summaryKeyFor} from "./deviceStorage";
describe("limpeza de dados no logout",()=>{
  it("apaga snapshots de outros escopos sem destruir preferências de outro aplicativo",()=>{
    const m=new Map([["dispatch.offline.agent.v1.1.2.3.list","old"],["external.settings","keep"],["dispatch.offline.agent.v1.9.8.7.list","old"]]);
    const fake={get length(){return m.size},key:(n:number)=>Array.from(m.keys())[n]??null,removeItem:(k:string)=>{m.delete(k)}};
    expect(clearFieldCache(fake)).toBe(2);
    expect(m.size).toBe(1);
    expect(m.get("external.settings")).toBe("keep");
  });
  it("constrói chave com usuário, organização e equipe",()=>{
    expect(summaryKeyFor({userId:1,organizationId:2,teamId:3})).toContain("1.2.3.list");
    expect(()=>summaryKeyFor({userId:0,organizationId:2,teamId:3})).toThrow();
  });
});
