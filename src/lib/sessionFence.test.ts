import {describe,expect,it} from "vitest";
import {PENDING_LOGOUT_KEY,markPendingLogout,hasPendingLogout,clearPendingLogout,assertSessionFenceWritable,shouldRevokeForLogoutFenceEvent} from "./sessionFence";
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
  it("checks persistent logout-fence availability before cookie-based login",()=>{
    const local=store();
    assertSessionFenceWritable(local);
    expect(local.length).toBe(0);
    const readOnly={
      getItem:(_key:string)=>null,
      setItem:(_key:string,_value:string)=>{throw new Error("write blocked");},
      removeItem:(_key:string)=>{},
    };
    expect(()=>assertSessionFenceWritable(readOnly)).toThrow(/write blocked/);
    expect(()=>markPendingLogout(readOnly)).toThrow(/write blocked/);
    const silentlyDiscarded={
      getItem:(_key:string)=>null,
      setItem:(_key:string,_value:string)=>{},
      removeItem:(_key:string)=>{},
    };
    expect(()=>assertSessionFenceWritable(silentlyDiscarded)).toThrow();
    expect(()=>markPendingLogout(silentlyDiscarded)).toThrow();
  });
  it("never clears a pending fence unless storage actually removed it",()=>{
    const cannotRemove={
      getItem:(key:string)=>key===PENDING_LOGOUT_KEY?"pending":null,
      setItem:(_key:string,_value:string)=>{},
      removeItem:(_key:string)=>{},
    };
    expect(()=>clearPendingLogout(cannotRemove)).toThrow();
  });

  it.each(["", "corrupted", "pending ", "0", "cleared", "{}", "PENDING"])(
    "blocks a session when logout marker has unknown value: %s",(unexpected)=>{
      const local=store();
      local.setItem(PENDING_LOGOUT_KEY,unexpected);
      expect(hasPendingLogout(local)).toBe(true);
      expect(()=>assertSessionFenceWritable(local)).not.toThrow();
      expect(hasPendingLogout(local)).toBe(true);
      clearPendingLogout(local);
      expect(local.getItem(PENDING_LOGOUT_KEY)).toBeNull();
      expect(hasPendingLogout(local)).toBe(false);
    }
  );
  it("rejects a storage backend that silently keeps a corrupted marker after clear",()=>{
    const sticky={
      getItem:(key:string)=>key===PENDING_LOGOUT_KEY?"corrupted":null,
      setItem:(_key:string,_value:string)=>{},
      removeItem:(_key:string)=>{},
    };
    expect(hasPendingLogout(sticky)).toBe(true);
    expect(()=>clearPendingLogout(sticky)).toThrow(/Encerramento/);
  });
  it.each(["", "pending", "corrupted", "0", "{}"])(
    "revokes other-tab field UI for any present logout marker: %s",value=>{
      expect(shouldRevokeForLogoutFenceEvent(PENDING_LOGOUT_KEY,value)).toBe(true);
    }
  );
  it("never unlocks a session on marker removal or unrelated storage keys",()=>{
    expect(shouldRevokeForLogoutFenceEvent(PENDING_LOGOUT_KEY,null)).toBe(false);
    expect(shouldRevokeForLogoutFenceEvent("unrelated.key","pending")).toBe(false);
    expect(shouldRevokeForLogoutFenceEvent(null,"pending")).toBe(false);
  });
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
