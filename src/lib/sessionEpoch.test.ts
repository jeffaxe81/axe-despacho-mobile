import { describe, expect, it } from "vitest";
import { SessionEpoch } from "./sessionEpoch";

function deferred<T>() {
  let resolve!: (value:T)=>void;
  let reject!: (reason:unknown)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}

describe("session epoch: reject async data after identity or team changes",()=>{
  it("is fail-closed before server identity is checked",()=>{
    const fence=new SessionEpoch();
    const ticket=fence.snapshot();
    expect(fence.isCurrent(ticket)).toBe(true);
    expect(fence.isOperational(ticket)).toBe(false);
  });
  it("only a completed current authentication unlocks requests",()=>{
    const fence=new SessionEpoch();
    const old=fence.beginAuthentication();
    const newer=fence.beginAuthentication();
    expect(fence.grant(old)).toBe(false);
    expect(fence.isOperational(old)).toBe(false);
    expect(fence.grant(newer)).toBe(true);
    expect(fence.isOperational(newer)).toBe(true);
  });
  it("invalidates all previous reads and mutations upon logout",()=>{
    const fence=new SessionEpoch();
    const ticket=fence.beginAuthentication();
    fence.grant(ticket);
    const pending=fence.snapshot();
    fence.revoke();
    expect(fence.isOperational(pending)).toBe(false);
    expect(fence.isCurrent(pending)).toBe(false);
    expect(fence.grant(pending)).toBe(false);
    expect(fence.isOperational(fence.snapshot())).toBe(false);
  });
  it("network notifications during bootstrap do not strand the authentication flow",()=>{
    const fence=new SessionEpoch();
    const pending=fence.beginAuthentication();
    const returned=fence.changeScope();
    expect(returned).toBe(pending);
    expect(fence.isCurrent(pending)).toBe(true);
    expect(fence.grant(pending)).toBe(true);
    expect(fence.isOperational(pending)).toBe(true);
  });
  it("team/organization changes preserve current authorization but invalidate old requests",()=>{
    const fence=new SessionEpoch();
    const first=fence.beginAuthentication();
    fence.grant(first);
    const switched=fence.changeScope();
    expect(fence.isCurrent(first)).toBe(false);
    expect(fence.isOperational(first)).toBe(false);
    expect(fence.isOperational(switched)).toBe(true);
    expect(fence.grant(first)).toBe(false);
  });
  it("re-login after revocation requires a fresh server-checked token",()=>{
    const fence=new SessionEpoch();
    const first=fence.beginAuthentication();
    fence.grant(first);
    fence.revoke();
    const second=fence.beginAuthentication();
    expect(fence.isOperational(second)).toBe(false);
    expect(fence.grant(first)).toBe(false);
    expect(fence.grant(second)).toBe(true);
    expect(fence.isOperational(second)).toBe(true);
  });
  it("can fence an obsolete bootstrap that returns after a newer bootstrap",async()=>{
    const fence=new SessionEpoch();
    const first=fence.beginAuthentication();
    const delayed=deferred<{userId:number}>();
    const pending=delayed.promise.then(value=>fence.isCurrent(first) && fence.grant(first)?value:null);
    const second=fence.beginAuthentication();
    expect(fence.grant(second)).toBe(true);
    delayed.resolve({userId:100});
    expect(await pending).toBeNull();
    expect(fence.isOperational(first)).toBe(false);
    expect(fence.isOperational(second)).toBe(true);
  });
  it("can fence a late incident read after a logout in another tab",async()=>{
    const fence=new SessionEpoch();
    const ticket=fence.beginAuthentication();
    fence.grant(ticket);
    const delayed=deferred<string[]>();
    const pending=delayed.promise.then(rows=>fence.isOperational(ticket)?rows:[]);
    fence.revoke();
    delayed.resolve(["ocorrência antiga"]);
    expect(await pending).toEqual([]);
  });
  it("can fence a completed API mutation after the tenant was switched",async()=>{
    const fence=new SessionEpoch();
    const ticket=fence.beginAuthentication();
    fence.grant(ticket);
    const delayed=deferred<string>();
    const pending=delayed.promise.then(result=>fence.isOperational(ticket)?result:"ignorado");
    const next=fence.changeScope();
    delayed.resolve("mutação concluída");
    expect(await pending).toBe("ignorado");
    expect(fence.isOperational(next)).toBe(true);
  });
  it("revocation prevents showing a late server authorization rejection for an old user",async()=>{
    const fence=new SessionEpoch();
    const ticket=fence.beginAuthentication();
    fence.grant(ticket);
    const delayed=deferred<void>();
    const pending=delayed.promise.catch(()=>fence.isOperational(ticket)?"erro antigo":"descartar");
    fence.revoke();
    delayed.reject(new Error("API 403 old user"));
    expect(await pending).toBe("descartar");
  });
  it("does not accept a stale authorization grant after logout and restart",()=>{
    const fence=new SessionEpoch();
    const old=fence.beginAuthentication();
    fence.revoke();
    fence.beginAuthentication();
    expect(fence.grant(old)).toBe(false);
  });
  it.each(Array.from({length:40},(_,i)=>({label:`async-epoch-race-${i+1}`,turns:i+1})))(
    "ignores older operations across repeated scope rotations: $label",({turns})=>{
      const fence=new SessionEpoch();
      const old=fence.beginAuthentication();
      expect(fence.grant(old)).toBe(true);
      let current=old;
      for(let i=0;i<turns;i++){
        const next=fence.changeScope();
        expect(fence.isOperational(current)).toBe(false);
        current=next;
      }
      expect(fence.isOperational(old)).toBe(false);
      expect(fence.isOperational(current)).toBe(true);
      fence.revoke();
      expect(fence.isOperational(current)).toBe(false);
    }
  );
});
