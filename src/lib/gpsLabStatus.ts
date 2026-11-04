export type GpsLabDisplayState = "stopped" | "waiting" | "current" | "stale";

/**
 * Android lab reports only a timestamp, never coordinates. Running service
 * alone does not imply a current fix, and an old fix must never be shown as
 * a live position in the field.
 */
export const GPS_LAB_MAX_FIX_AGE_MS = 60_000;

export function gpsLabDisplayState(
  running: boolean,
  lastFixAt: number,
  now: number
): GpsLabDisplayState {
  if (!running) return "stopped";
  if (!Number.isFinite(now) || !Number.isFinite(lastFixAt) ||
      lastFixAt <= 0 || lastFixAt > now) return "waiting";
  return now - lastFixAt <= GPS_LAB_MAX_FIX_AGE_MS ? "current" : "stale";
}

export const gpsLabDisplayLabels: Record<GpsLabDisplayState, string> = {
  stopped: "Desligado",
  waiting: "Aguardando uma posição válida",
  current: "Captura recente",
  stale: "Sem captura recente (atrasada)"
};
