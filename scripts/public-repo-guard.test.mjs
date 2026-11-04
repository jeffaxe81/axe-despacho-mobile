import {describe,expect,it} from "vitest";
import {isForbiddenTrackedPath,validateTrackedPaths} from "./public-repo-guard.mjs";
describe("public AXE Despacho Mobile repository",()=>{
  it("blocks signing keys and mobile provisioning files",()=>{
    expect(isForbiddenTrackedPath("android/upload.jks")).toBe(true);
    expect(isForbiddenTrackedPath("ios/AuthKey_ABCD.p8")).toBe(true);
    expect(isForbiddenTrackedPath("google-services.json")).toBe(true);
  });
  it("blocks credentials but allows safe examples and source files",()=>{
    expect(isForbiddenTrackedPath(".env.production")).toBe(true);
    expect(isForbiddenTrackedPath(".env")).toBe(true);
    expect(isForbiddenTrackedPath(".env.example")).toBe(false);
    expect(validateTrackedPaths(["README.md",".env.example","src/App.tsx"])).toEqual([]);
  });
});
