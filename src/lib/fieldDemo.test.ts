import {describe,expect,it} from "vitest";
import {applyDemoAction,initialDemoState,permittedDemoActions,selectDemo,DEMO_LABEL} from "./fieldDemo";

describe("Android field demonstration has no operational side effects",()=>{
  it("starts with marked fictitious incidents, no credentials or GPS",()=>{
    const state=initialDemoState();
    expect(state.incidents).toHaveLength(3);
    expect(state.incidents.every(i=>i.code.startsWith("DEMO-"))).toBe(true);
    expect(JSON.stringify(state)).not.toMatch(/token|longitude|latitude|senha/i);
    expect(DEMO_LABEL).toContain("NÃO CONECTADO");
  });
  it("allows only valid sequential transitions without mutating previous state",()=>{
    const a=initialDemoState();
    expect(permittedDemoActions("despachada")).toEqual(["accept","decline"]);
    const b=applyDemoAction(a,90001,"accept",1000);
    const c=applyDemoAction(b,90001,"start",2000);
    const d=applyDemoAction(c,90001,"pause",3000);
    const e=applyDemoAction(d,90001,"resume",4000);
    const f=applyDemoAction(e,90001,"finish",5000);
    expect(a.incidents[0].status).toBe("despachada");
    expect(f.incidents[0].status).toBe("concluida");
    expect(f.events).toHaveLength(5);
    expect(permittedDemoActions("concluida")).toEqual([]);
    expect(()=>applyDemoAction(f,90001,"finish")).toThrow();
  });
  it("rejects transitions for another occurrence and resets cleanly",()=>{
    const a=initialDemoState();
    expect(()=>applyDemoAction(a,90003,"accept")).toThrow();
    expect(()=>selectDemo(a,12345)).toThrow();
    const b=applyDemoAction(selectDemo(a,90002),90002,"start");
    expect(b.selectedId).toBe(90002);
    expect(initialDemoState().events).toHaveLength(0);
    expect(initialDemoState().incidents[1].status).toBe("aceita");
  });
});
