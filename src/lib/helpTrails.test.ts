import {describe,expect,it} from "vitest";
import {HELP_TRAILS,availableHelpTrails} from "./helpTrails";

describe("guided help content safety and completeness",()=>{
  it("offers progressive guides before login on Android and web",()=>{
    expect(availableHelpTrails("android").some(t=>t.id==="android-demo")).toBe(true);
    expect(availableHelpTrails("web").some(t=>t.id==="inicio-web")).toBe(true);
    expect(availableHelpTrails("web").some(t=>t.id==="android-demo")).toBe(false);
    expect(availableHelpTrails("android").some(t=>t.id==="despacho-web")).toBe(false);
  });
  it("all trails are unique, bounded and documented for incidents",()=>{
    const ids=HELP_TRAILS.map(t=>t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(7);
    for(const trail of HELP_TRAILS){
      expect(trail.title.trim().length).toBeGreaterThan(4);
      expect(trail.steps.length).toBeGreaterThanOrEqual(3);
      expect(trail.steps.every(step=>step.length>15&&step.length<250)).toBe(true);
      expect(trail.caution.trim().length).toBeGreaterThan(12);
    }
  });
  it("does not promise an operational native login, API REST or background GPS",()=>{
    const android=availableHelpTrails("android").map(t=>t.summary+" "+t.caution).join("\n").toLowerCase();
    expect(android).toContain("desabilitado");
    expect(android).toContain("não envia coordenadas");
    const integrations=HELP_TRAILS.find(t=>t.id==="apis")!;
    expect(integrations.caution.toLowerCase()).toContain("nenhuma nova api rest");
  });
  it("always includes recovery and API-integrator guidance",()=>{
    for(const environment of ["android","web"] as const){
      const ids=availableHelpTrails(environment).map(t=>t.id);
      expect(ids).toContain("recuperacao");
      expect(ids).toContain("apis");
    }
  });
});
