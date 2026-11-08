/**
 * Safety gate for foreground GPS attempts. The ledger is volatile and stores
 * only timestamps keyed by numeric tenant/team IDs — never coordinates,
 * tokens, secrets or an offline upload queue.
 *
 * A write timeout is ambiguous: the central may have received the point.
 * Retain the attempted fix across effect restarts (network/foreground/toggle)
 * so the same capture is not automatically sent a second time.
 */
import {assessGpsPrecision} from "./gpsPrecision";

const INTERVAL_MS = 20_000;
const MAX_AGE_MS = 30_000;
const MAX_SCOPES = 16;

type LocationFix = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};
type Attempt = { sentAt: number; fixAt: number };

export function shouldTransmitLocation(lastSentAt:number, now:number) {
  return Number.isFinite(now) && now>=0 &&
    (lastSentAt===0 || (now>=lastSentAt && now-lastSentAt>=INTERVAL_MS));
}

/** Geometry and freshness gate; allows reporting poor-quality GPS to the UI
 * without accidentally treating it as a position authorized for transmission.
 */
export function isRecentLocationSample(position:LocationFix, now:number):boolean {
  return Number.isFinite(now) && now>=0 &&
    Number.isFinite(position.latitude) && Math.abs(position.latitude)<=90 &&
    Number.isFinite(position.longitude) && Math.abs(position.longitude)<=180 &&
    Number.isFinite(position.timestamp) && position.timestamp>=0 &&
    position.timestamp<=now && now-position.timestamp<=MAX_AGE_MS;
}

export function validLocation(position:LocationFix, now:number):boolean {
  return isRecentLocationSample(position,now) &&
    assessGpsPrecision(position.accuracy).operational;
}

/** Minimum delay between attempts, not just successful uploads. */
export function shouldAttemptFreshLocation(
  lastAttemptAt: number | null,
  lastAttemptFixAt: number | null,
  point: LocationFix,
  now: number
): boolean {
  if (!validLocation(point,now)) return false;
  if (lastAttemptFixAt !== null &&
      (!Number.isFinite(lastAttemptFixAt) || point.timestamp <= lastAttemptFixAt)) return false;
  if (lastAttemptAt === null) return true;
  return Number.isFinite(lastAttemptAt) && lastAttemptAt >= 0 &&
    now >= lastAttemptAt && now-lastAttemptAt >= INTERVAL_MS;
}

/**
 * Reused for the lifetime of the mounted field UI, including GPS off/on and
 * temporary loss of foreground/network. Switching back to an earlier scope
 * does not forget its last attempted fix. The size cap bounds memory use.
 */
export class GpsAttemptLedger {
  private readonly attempts = new Map<string, Attempt>();

  beginAttempt(organizationId:number, teamId:number, fix:LocationFix, now:number):boolean {
    if (!Number.isSafeInteger(organizationId) || organizationId<=0 ||
        !Number.isSafeInteger(teamId) || teamId<=0) return false;
    const key=`${organizationId}:${teamId}`;
    const previous=this.attempts.get(key);
    if (!shouldAttemptFreshLocation(previous?.sentAt??null, previous?.fixAt??null, fix, now)) return false;
    // Book the attempt before any asynchronous API call; never retry a
    // possibly successful write, even when the response is lost.
    this.attempts.delete(key);
    this.attempts.set(key,{sentAt:now,fixAt:fix.timestamp});
    if(this.attempts.size>MAX_SCOPES){
      const oldest=this.attempts.keys().next().value;
      if(oldest!==undefined)this.attempts.delete(oldest);
    }
    return true;
  }
}
