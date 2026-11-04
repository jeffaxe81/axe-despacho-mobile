import { afterEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import superjson from "superjson";
import { api } from "./api";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("server-confirmed logout", () => {
  function mockResult(value: unknown) {
    vi.stubGlobal("window", { location: { origin: "https://central.example" } });
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ result: { data: superjson.serialize(value) } }),
    }));
  }
  it("accepts only explicit success=true from the server", async () => {
    mockResult({ success: true });
    await expect(api.logout()).resolves.toEqual({ success: true });
  });
  it("keeps local fence intact when server reports unsuccessful logout", async () => {
    mockResult({ success: false });
    await expect(api.logout()).rejects.toMatchObject({ code: "LOGOUT_UNCONFIRMED" });
  });
  it("rejects missing confirmation rather than treating HTTP 200 as logout", async () => {
    mockResult({});
    await expect(api.logout()).rejects.toMatchObject({ code: "LOGOUT_UNCONFIRMED" });
  });
});
