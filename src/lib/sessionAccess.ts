import { ApiError } from "./api";

/**
 * A rejected session/permission is different from a transient network outage.
 * In those cases any previously rendered incident details must be revoked.
 *
 * Never infer revocation from TIMEOUT or NETWORK_ERROR: a disconnected agent
 * can still display a non-operational warning without claiming auth failure.
 */
const REVOKED_CODES = new Set([
  "UNAUTHORIZED", "UNAUTHENTICATED", "SESSION_EXPIRED",
  "FORBIDDEN", "PERMISSION_DENIED", "401", "403"
]);

export function isAccessRevoked(error: unknown): boolean {
  return error instanceof ApiError && REVOKED_CODES.has(error.code.toUpperCase());
}
