import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { isAccessRevoked } from "./sessionAccess";

describe("mobile field session revocation", () => {
  it.each(["UNAUTHORIZED", "UNAUTHENTICATED", "SESSION_EXPIRED", "FORBIDDEN", "PERMISSION_DENIED", "401", "403"])(
    "revokes an authenticated field view on %s", (code) => {
      expect(isAccessRevoked(new ApiError("Acesso negado", code))).toBe(true);
    }
  );
  it.each(["NETWORK_ERROR", "TIMEOUT", "ABORTED", "INVALID_ASSIGNMENTS", "TEAM_SCOPE_MISMATCH", "500"])(
    "does not confuse transient/validation error %s with session revocation", (code) => {
      expect(isAccessRevoked(new ApiError("Erro", code))).toBe(false);
    }
  );
  it("does not infer revocation from arbitrary errors", () => {
    expect(isAccessRevoked(new Error("401"))).toBe(false);
    expect(isAccessRevoked(null)).toBe(false);
  });
});
