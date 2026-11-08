import { describe, expect, it } from "vitest";
import { GpsAttemptLedger, validLocation } from "./gpsAttemptLedger";

const fix=(timestamp:number)=>({latitude:-27.6,longitude:-48.6,accuracy:15,timestamp});

describe("GPS: no replay after reconnect, app pause, or consent toggle",()=>{
  it("books an ambiguous attempt before its HTTP response and never repeats that fix",()=>{
    const ledger=new GpsAttemptLedger();
    expect(ledger.beginAttempt(1,9,fix(100_000),100_100)).toBe(true);
    // The component's sharing effect can be torn down/restarted here.
    expect(ledger.beginAttempt(1,9,fix(100_000),121_000)).toBe(false);
    expect(ledger.beginAttempt(1,9,fix(120_900),121_000)).toBe(true);
  });
  it("blocks a newer point until 20 seconds since the last ATTEMPT",()=>{
    const ledger=new GpsAttemptLedger();
    expect(ledger.beginAttempt(1,9,fix(100_000),100_000)).toBe(true);
    expect(ledger.beginAttempt(1,9,fix(119_999),119_999)).toBe(false);
    expect(ledger.beginAttempt(1,9,fix(120_000),120_000)).toBe(true);
  });
  it("retains last attempt when switching away and back to the same tenant/team",()=>{
    const ledger=new GpsAttemptLedger();
    expect(ledger.beginAttempt(1,9,fix(100_000),100_000)).toBe(true);
    expect(ledger.beginAttempt(2,9,fix(100_100),100_100)).toBe(true);
    expect(ledger.beginAttempt(1,9,fix(100_000),140_000)).toBe(false);
    expect(ledger.beginAttempt(1,9,fix(139_900),140_000)).toBe(true);
  });
  it("never mutates the ledger for invalid scopes or invalid GPS fixes",()=>{
    const ledger=new GpsAttemptLedger();
    expect(ledger.beginAttempt(0,9,fix(100_000),100_000)).toBe(false);
    expect(ledger.beginAttempt(1,NaN,fix(100_000),100_000)).toBe(false);
    expect(ledger.beginAttempt(1,9,{...fix(100_000),accuracy:251},100_000)).toBe(false);
    expect(ledger.beginAttempt(1,9,fix(100_000),100_000)).toBe(true);
    expect(ledger.beginAttempt(1,9,fix(100_000),120_000)).toBe(false);
  });
  it("rejects invalid clock readings and prehistoric GPS captures",()=>{
    expect(validLocation(fix(-1),0)).toBe(false);
    expect(validLocation(fix(0),Number.NaN)).toBe(false);
    expect(validLocation(fix(0),-1)).toBe(false);
  });
  it("rejects replay from another effect after an uncertain timeout",()=>{
    const ledger=new GpsAttemptLedger();
    expect(ledger.beginAttempt(3,27,fix(1_000_000),1_000_000)).toBe(true);
    // Simulate a lost response + second effect with the same GNSS timestamp.
    expect(ledger.beginAttempt(3,27,fix(1_000_000),1_020_000)).toBe(false);
    expect(ledger.beginAttempt(3,27,fix(1_020_000),1_020_000)).toBe(true);
  });
});
