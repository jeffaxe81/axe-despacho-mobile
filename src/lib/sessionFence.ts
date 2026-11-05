/**
 * Refuse to reuse a still-valid HttpOnly session cookie after a failed remote
 * logout. The persistent marker contains NO token, password or user data.
 */
export const PENDING_LOGOUT_KEY = "dispatch.mobile.pendingLogout.v1";
const FENCE_PROBE_KEY = "dispatch.mobile.fenceProbe.v1";
type FenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Browser storage must be readable AND writable before a cookie-backed login.
 * A browser that allows reads but rejects writes cannot safely persist the
 * pending-logout marker on a network failure. Fail closed in that case.
 */
export function assertSessionFenceWritable(storage: FenceStorage): void {
  const previous = storage.getItem(FENCE_PROBE_KEY);
  storage.setItem(FENCE_PROBE_KEY, "probe");
  try {
    if (storage.getItem(FENCE_PROBE_KEY) !== "probe") {
      throw new Error("Armazenamento de sessão não confiável.");
    }
  } finally {
    if (previous === null) storage.removeItem(FENCE_PROBE_KEY);
    else storage.setItem(FENCE_PROBE_KEY, previous);
  }
  if (storage.getItem(FENCE_PROBE_KEY) !== previous) {
    throw new Error("Armazenamento de sessão não confiável.");
  }
}
export function markPendingLogout(storage: FenceStorage) {
  storage.setItem(PENDING_LOGOUT_KEY, "pending");
  if (storage.getItem(PENDING_LOGOUT_KEY) !== "pending") {
    throw new Error("Não foi possível proteger a sessão contra saída não confirmada.");
  }
}
export function hasPendingLogout(storage: FenceStorage) {
  // Corrupted/unknown markers must never silently turn a pending logout into
  // an authorized cookie-backed session. Only an ABSENT marker is unlocked.
  return storage.getItem(PENDING_LOGOUT_KEY) !== null;
}
export function clearPendingLogout(storage: FenceStorage) {
  storage.removeItem(PENDING_LOGOUT_KEY);
  if (hasPendingLogout(storage)) throw new Error("Encerramento não pôde ser desbloqueado.");
}
