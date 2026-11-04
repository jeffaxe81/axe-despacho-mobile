import { describe, expect, it } from "vitest";
import { GPS_LAB_MAX_FIX_AGE_MS, gpsLabDisplayState } from "./gpsLabStatus";

describe("Android GPS laboratory diagnostics without coordinates", () => {
  it("does not call an active service a valid fix by itself", () => {
    expect(gpsLabDisplayState(false, 20_000, 30_000)).toBe("stopped");
    expect(gpsLabDisplayState(true, 0, 30_000)).toBe("waiting");
    expect(gpsLabDisplayState(true, -1, 30_000)).toBe("waiting");
    expect(gpsLabDisplayState(true, Number.NaN, 30_000)).toBe("waiting");
  });
  it("labels fresh, stale and future timestamps safely", () => {
    expect(gpsLabDisplayState(true, 100_000, 100_000)).toBe("current");
    expect(gpsLabDisplayState(true, 100_000, 100_000 + GPS_LAB_MAX_FIX_AGE_MS)).toBe("current");
    expect(gpsLabDisplayState(true, 100_000, 100_001 + GPS_LAB_MAX_FIX_AGE_MS)).toBe("stale");
    expect(gpsLabDisplayState(true, 100_001, 100_000)).toBe("waiting");
    expect(gpsLabDisplayState(true, 100_000, Number.NaN)).toBe("waiting");
  });
});
