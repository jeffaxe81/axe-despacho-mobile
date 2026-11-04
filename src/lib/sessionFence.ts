/**
 * Prevent accidental re-authentication from a still-valid HttpOnly cookie when
 * remote logout failed, including after closing and reopening the web app.
 * This flag contains NO token or private data.
 */
export const PENDING_LOGOUT_KEY = "dispatch.mobile.pendingLogout.v1";
type FenceStorage = Pick<Storage,"getItem"|"setItem"|"removeItem">;
export function markPendingLogout(storage:FenceStorage) {
  storage.setItem(PENDING_LOGOUT_KEY,"pending");
}
export function hasPendingLogout(storage:FenceStorage) {
  return storage.getItem(PENDING_LOGOUT_KEY)==="pending";
}
export function clearPendingLogout(storage:FenceStorage) {
  storage.removeItem(PENDING_LOGOUT_KEY);
}
