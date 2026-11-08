import {describe,expect,it} from "vitest";
import {fieldOperationalState,type FieldOperationalInput} from "./fieldOperationalState";
const ready:FieldOperationalInput={
  native:false,logoutPending:false,online:true,foreground:true,
  authorized:true,conflict:false,needsValidation:false,snapshotFresh:true,working:false
};
describe("field agent: operational status is never an authorization source",()=>{
  it("says ready only when all policy inputs are ready",()=>{
    expect(fieldOperationalState(ready)).toMatchObject({kind:"ready"});
  });
  it.each([
    ["native",{native:true},"blocked"],
    ["pending logout",{logoutPending:true},"blocked"],
    ["offline",{online:false},"blocked"],
    ["background",{foreground:false},"blocked"],
    ["unauthorized",{authorized:false},"blocked"],
    ["conflicting active incidents",{conflict:true},"blocked"],
    ["revalidation",{needsValidation:true},"warning"],
    ["stale snapshot",{snapshotFresh:false},"warning"],
    ["inflight request",{working:true},"busy"]
  ] as const)("explains %s",(_name,patch,kind)=>{
    const current=fieldOperationalState({...ready,...patch});
    expect(current.kind).toBe(kind);
    expect(current.message.trim().length).toBeGreaterThan(20);
    expect(current.message).not.toMatch(/senha|token|latitude|longitude/i);
  });
  it("blocked cases always outrank busy and stale status",()=>{
    expect(fieldOperationalState({...ready,online:false,working:true,snapshotFresh:false}).kind).toBe("blocked");
    expect(fieldOperationalState({...ready,logoutPending:true,authorized:true}).kind).toBe("blocked");
  });
});
