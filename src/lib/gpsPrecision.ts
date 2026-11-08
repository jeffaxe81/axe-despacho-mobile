/** Horizontal accuracy reported by the device, in meters.
 * This is an estimate, not a promise of exact positioning or device trust.
 * Keep the operational ceiling aligned with the central's
 * server/teamLocationAccuracy.ts (250 m).
 */
export const GPS_EXCELLENT_MAX_METERS=20;
export const GPS_PREFERRED_MAX_METERS=50;
export const GPS_OPERATIONAL_MAX_METERS=250;

export type GpsPrecisionLevel="excellent"|"good"|"reduced"|"unreliable"|"unavailable";
export type GpsPrecisionAssessment={
  level:GpsPrecisionLevel;
  label:string;
  operational:boolean;
  preferred:boolean;
};
export function assessGpsPrecision(accuracyMeters:unknown):GpsPrecisionAssessment{
  if(typeof accuracyMeters!=="number"||!Number.isFinite(accuracyMeters)||accuracyMeters<0){
    return {level:"unavailable",label:"Aguardando medição",operational:false,preferred:false};
  }
  if(accuracyMeters<=GPS_EXCELLENT_MAX_METERS)
    return {level:"excellent",label:"Excelente",operational:true,preferred:true};
  if(accuracyMeters<=GPS_PREFERRED_MAX_METERS)
    return {level:"good",label:"Boa",operational:true,preferred:true};
  if(accuracyMeters<=GPS_OPERATIONAL_MAX_METERS)
    return {level:"reduced",label:"Precisão reduzida",operational:true,preferred:false};
  return {level:"unreliable",label:"Não confiável",operational:false,preferred:false};
}
export function gpsAccuracyLabel(accuracyMeters:unknown):string{
  if(typeof accuracyMeters!=="number"||!Number.isFinite(accuracyMeters)||accuracyMeters<0)
    return "—";
  // Rounding up avoids making e.g. 250.4 m look like an acceptable 250 m.
  return `${Math.ceil(accuracyMeters)} m`;
}
