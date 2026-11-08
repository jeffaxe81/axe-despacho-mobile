import {assessGpsPrecision} from "./gpsPrecision";

/**
 * Private, volatile field-quality observations. Never store/send latitude,
 * longitude, team, incident, network identifiers, or authentication material.
 * This is deterministic statistical analysis, NOT a trained AI model.
 */
export type GpsQualitySample=Readonly<{accuracyMeters:number;capturedAt:number}>;
export type GpsQualityTrend="improving"|"worsening"|"stable"|"insufficient";
export type GpsQualityAdvice={
  trend:GpsQualityTrend;
  unstable:boolean;
  sampleCount:number;
  medianAccuracyMeters:number|null;
  recommendation:"waiting"|"move_to_open_area"|"allow_precise_location"|"signal_improving"|"signal_worsening"|"maintain";
  explanation:string;
};
export const GPS_QUALITY_MAX_SAMPLES=12;
const MAX_FRESH_MS=30_000;
function valid(sample:GpsQualitySample,now:number):boolean{
  return Number.isSafeInteger(sample.capturedAt)&&sample.capturedAt>=0&&
    Number.isFinite(sample.accuracyMeters)&&sample.accuracyMeters>=0&&
    sample.accuracyMeters<=10_000&&Number.isSafeInteger(now)&&
    sample.capturedAt<=now&&now-sample.capturedAt<=MAX_FRESH_MS;
}
function median(values:readonly number[]):number{
  const sorted=[...values].sort((a,b)=>a-b);
  const center=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[center]:(sorted[center-1]+sorted[center])/2;
}
/** Append quality only. Reject stale/out-of-order/duplicate samples; cap
 * memory and clear on consent loss, scope changes or cleanup.
 */
export function appendGpsQualitySample(
 history:readonly GpsQualitySample[],
 candidate:GpsQualitySample,
 now:number
):GpsQualitySample[]{
  if(!valid(candidate,now))return [...history];
  const recent=history.filter(x=>valid(x,now));
  const previous=recent.at(-1);
  if(previous&&candidate.capturedAt<=previous.capturedAt)return recent;
  return [...recent,{
    accuracyMeters:candidate.accuracyMeters,
    capturedAt:candidate.capturedAt
  }].slice(-GPS_QUALITY_MAX_SAMPLES);
}
export function analyzeGpsQuality(
 observations:readonly GpsQualitySample[],now:number
):GpsQualityAdvice{
  const samples=observations.filter(x=>valid(x,now)).slice(-GPS_QUALITY_MAX_SAMPLES);
  if(!samples.length)return {
    trend:"insufficient",unstable:false,sampleCount:0,medianAccuracyMeters:null,
    recommendation:"waiting",explanation:"Aguardando medições recentes para analisar a qualidade do sinal."
  };
  const accuracies=samples.map(s=>s.accuracyMeters);
  const medianAccuracyMeters=median(accuracies);
  const current=assessGpsPrecision(samples.at(-1)!.accuracyMeters);
  const trend:GpsQualityTrend=(()=>{
    if(samples.length<6)return "insufficient";
    const first=median(accuracies.slice(0,3)),last=median(accuracies.slice(-3));
    const meaningful=Math.max(5,first*0.2);
    if(last<=first-meaningful)return "improving";
    if(last>=first+meaningful)return "worsening";
    return "stable";
  })();
  const unstable=samples.length>=4&&Math.max(...accuracies)-Math.min(...accuracies)>Math.max(50,medianAccuracyMeters*1.5);
  let recommendation:GpsQualityAdvice["recommendation"]="maintain";
  let explanation="Mantenha a localização precisa e aguarde a próxima leitura do aparelho.";
  if(current.level==="unreliable"){
    recommendation="move_to_open_area";
    explanation="Precisão acima de 250 metros. Procure uma área aberta e aguarde; esta leitura não pode ser enviada.";
  } else if(current.level==="unavailable"){
    recommendation="allow_precise_location";
    explanation="A medição não tem precisão válida. Confira a autorização de localização precisa no aparelho.";
  } else if(unstable){
    recommendation="waiting";
    explanation="A precisão oscilou muito nas últimas leituras. Aguarde uma medição estável antes de confiar no indicador.";
  } else if(trend==="improving"){
    recommendation="signal_improving";
    explanation="A estimativa de precisão está melhorando; acompanhe a próxima leitura antes de decidir.";
  } else if(trend==="worsening"){
    recommendation="signal_worsening";
    explanation="A precisão está piorando. Verifique obstruções e procure uma área aberta quando for seguro.";
  } else if(current.preferred){
    explanation="Precisão dentro da meta de 50 metros, sujeita às permissões e verificações da central.";
  }
  return {trend,unstable,sampleCount:samples.length,medianAccuracyMeters,recommendation,explanation};
}

/** Minimal allowlisted context for a future tenant-owned AI backend adapter.
 * No network activity is performed here, no provider keys are stored on a
 * client, and an AI must NEVER authorize location writes or override 250m.
 */
export type GpsAiFeatureEnvelope=Readonly<{
  schema:"gps-quality-v1";
  trend:GpsQualityTrend;
  unstable:boolean;
  sampleCount:number;
  medianAccuracyRoundedMeters:number|null;
}>;
export function toGpsAiFeatures(advice:GpsQualityAdvice):GpsAiFeatureEnvelope{
  return {
    schema:"gps-quality-v1",trend:advice.trend,unstable:advice.unstable,
    sampleCount:advice.sampleCount,
    medianAccuracyRoundedMeters:advice.medianAccuracyMeters===null?null:Math.ceil(advice.medianAccuracyMeters)
  };
}
export type GpsAiActionCode="wait"|"open_area"|"precise_permission"|"check_sky_view";
export interface GpsAiBackendProvider{
  /** Injected only after explicit opt-in + backend auth; not used by this build. */
  advise(input:GpsAiFeatureEnvelope):Promise<unknown>;
}
export function validateGpsAiActionCode(untrusted:unknown):GpsAiActionCode|null{
  if(typeof untrusted!=="object"||untrusted===null||Array.isArray(untrusted))return null;
  const object=untrusted as Record<string,unknown>;
  if(Object.keys(object).length!==1||typeof object.action!=="string")return null;
  return (["wait","open_area","precise_permission","check_sky_view"] as const)
    .find(code=>code===object.action)??null;
}
