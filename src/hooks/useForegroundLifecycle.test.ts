import {describe,expect,it} from "vitest";
import {shouldRevokeOnAppStateChange} from "./useForegroundLifecycle";

describe("Android Activity operational safety",()=>{
  it("revokes active GPS and requires server revalidation when app backgrounded",()=>{
    expect(shouldRevokeOnAppStateChange(false)).toBe(true);
  });
  it("does not automatically resume tracking when Activity becomes active",()=>{
    expect(shouldRevokeOnAppStateChange(true)).toBe(false);
  });
});
