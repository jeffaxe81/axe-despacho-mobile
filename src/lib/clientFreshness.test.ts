import {describe,it,expect} from "vitest";
import {FIELD_SNAPSHOT_MAX_AGE_MS,isFieldSnapshotFresh,shouldQueryLiveAssignments,timeSinceVerification} from "./clientFreshness";
describe("mobile client data freshness and connectivity",()=>{
  it("requires confirmed recent server data before enabling any field action",()=>{
    expect(isFieldSnapshotFresh(null,50_000)).toBe(false);
    expect(isFieldSnapshotFresh(50_000,50_000)).toBe(true);
    expect(isFieldSnapshotFresh(50_000,50_000+FIELD_SNAPSHOT_MAX_AGE_MS)).toBe(true);
    expect(isFieldSnapshotFresh(50_000,50_001+FIELD_SNAPSHOT_MAX_AGE_MS)).toBe(false);
    expect(isFieldSnapshotFresh(50_000,49_999)).toBe(false);
    expect(isFieldSnapshotFresh(-1,0)).toBe(false);
  });
  it("never polls unauthorized, offline, background or native WebView sessions",()=>{
    expect(shouldQueryLiveAssignments(true,true,true,false)).toBe(true);
    expect(shouldQueryLiveAssignments(true,false,true,false)).toBe(false);
    expect(shouldQueryLiveAssignments(true,true,false,false)).toBe(false);
    expect(shouldQueryLiveAssignments(false,true,true,false)).toBe(false);
    expect(shouldQueryLiveAssignments(true,true,true,true)).toBe(false);
  });
  it("shows human-readable staleness without falsely claiming synchronization",()=>{
    expect(timeSinceVerification(null,60_000)).toBe("Sem validação recente");
    expect(timeSinceVerification(51_000,60_000)).toBe("Sincronizado há 9s");
    expect(timeSinceVerification(10,100_000)).toBe("Sem validação recente");
  });
});
