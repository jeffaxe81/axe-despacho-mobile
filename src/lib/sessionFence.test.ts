import {describe,expect,it} from "vitest";
import {PENDING_LOGOUT_KEY,markPendingLogout,hasPendingLogout,clearPendingLogout} from "./sessionFence";
import {clearFieldCache} from "./deviceStorage";

function store() {
  const data = new Map<string,string>();
  return {
    getItem:(key:string)=>data.get(key)??null,
    setItem:(key:string,value:string)=>{data.set(key,value);},
    removeItem:(key:string)=>{data.delete(key);},
    key:(n:number)=>Array.from(data.keys())[n]??null,
    get length(){return data.size;},
  };
}
describe("session logout fence protects web client after remote logout failure",()=>{
  it("persists a pending-logout flag across app views without storing credentials",()=>{
    const local=store();
    markPendingLogout(local);
    expect(hasPendingLogout(local)).toBe(true);
    expect(local.getItem(PENDING_LOGOUT_KEY)).toBe("pending");
    expect(JSON.stringify(local.getItem(PENDING_LOGOUT_KEY))).not.toMatch(/token|senha|password/i);
    clearPendingLogout(local);
    expect(hasPendingLogout(local)).toBe(false);
  });
  it("is not erased by ordinary redacted field-cache cleanup",()=>{
    const local=store();
    local.setItem("dispatch.offline.agent.v1.1.2.3.list","cached");
    markPendingLogout(local);
    expect(clearFieldCache(local)).toBe(1);
    expect(hasPendingLogout(local)).toBe(true);
  });
});
