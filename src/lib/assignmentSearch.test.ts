import {describe,expect,it} from "vitest";
import {filterLoadedAssignments,MAX_ASSIGNMENT_QUERY_CHARS} from "./assignmentSearch";
import type {AssignmentRow} from "./contracts";

const sample:AssignmentRow[]=[
  {incident:{id:1,code:"OCO-101",status:"despachada",priority:"alta",category:"Saúde",address:"RESERVADO",description:"DADO_PESSOAL",assignedTeamId:7}},
  {incident:{id:2,code:"OCO-102",status:"aceita",priority:"critica",category:"Trânsito",address:"RESERVADO",description:"DADO_PESSOAL",assignedTeamId:7}},
  {incident:{id:3,code:"OCO-103",status:"em_atendimento",priority:"media",category:"Segurança",address:"RESERVADO",description:"DADO_PESSOAL",assignedTeamId:7}},
  {incident:{id:4,code:"OCO-104",status:"pausada",priority:"baixa",category:"Resgate",address:"RESERVADO",description:"DADO_PESSOAL",assignedTeamId:7}},
  {incident:{id:5,code:"OCO-105",status:"concluida",priority:"baixa",category:"Apoio",address:"RESERVADO",description:"DADO_PESSOAL",assignedTeamId:7}},
  {incident:{id:6,code:"OCO-106",status:"cancelada",priority:"media",category:"Apoio",address:"RESERVADO",description:"DADO_PESSOAL",assignedTeamId:7}}
];

describe("local-only incident list UX",()=>{
  it("keeps all original server rows and order without filter",()=>{
    expect(filterLoadedAssignments(sample,"","all")).toEqual(sample);
    expect(sample).toHaveLength(6);
  });
  it.each([
    ["dispatched",[1]],["active",[2,3,4]],["finished",[5,6]],["all",[1,2,3,4,5,6]]
  ] as const)("applies view-only statuses without editing authorization state %s",(view,ids)=>{
    expect(filterLoadedAssignments(sample,"",view).map(x=>x.incident.id)).toEqual(ids);
  });
  it("supports accents, case and whitespace in code or category",()=>{
    expect(filterLoadedAssignments(sample,"  SAUDE ","all").map(x=>x.incident.id)).toEqual([1]);
    expect(filterLoadedAssignments(sample,"transito","active").map(x=>x.incident.id)).toEqual([2]);
    expect(filterLoadedAssignments(sample,"oco-10","all")).toHaveLength(6);
  });
  it("does not search incident address, description or private details",()=>{
    expect(filterLoadedAssignments(sample,"DADO_PESSOAL","all")).toHaveLength(0);
    expect(filterLoadedAssignments(sample,"RESERVADO","all")).toHaveLength(0);
  });
  it("caps long input and never mutates selected payload",()=>{
    const query="X".repeat(MAX_ASSIGNMENT_QUERY_CHARS+500);
    expect(filterLoadedAssignments(sample,query,"all")).toEqual([]);
    expect(sample[0].incident.address).toBe("RESERVADO");
  });
  it("filters loaded results only: cannot imply global server filtering",()=>{
    expect(filterLoadedAssignments(sample.slice(0,2),"apoio","all")).toEqual([]);
  });
});
