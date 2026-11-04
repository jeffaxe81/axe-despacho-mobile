/** Runtime guards shared by the field UI and its tests. */
export const FIELD_REFRESH_INTERVAL_MS = 15_000;
export const FIELD_SNAPSHOT_MAX_AGE_MS = 45_000;
export function isFieldSnapshotFresh(verifiedAt:number|null, now:number):boolean {
  return typeof verifiedAt==="number" && Number.isFinite(verifiedAt) &&
    Number.isFinite(now) && verifiedAt>=0 && now>=verifiedAt &&
    now-verifiedAt<=FIELD_SNAPSHOT_MAX_AGE_MS;
}
export function shouldQueryLiveAssignments(authorized:boolean,online:boolean,foreground:boolean,native:boolean):boolean {
  return authorized && online && foreground && !native;
}
export function timeSinceVerification(verifiedAt:number|null, now:number):string {
  if(!isFieldSnapshotFresh(verifiedAt,now))return "Sem validação recente";
  const seconds=Math.max(0,Math.floor((now-verifiedAt!)/1000));
  return seconds===0?"Sincronizado agora":`Sincronizado há ${seconds}s`;
}
