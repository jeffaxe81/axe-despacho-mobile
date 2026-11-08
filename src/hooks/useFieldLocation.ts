import { Geolocation } from "@capacitor/geolocation";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { isAccessRevoked } from "../lib/sessionAccess";
import { GpsAttemptLedger, isRecentLocationSample, validLocation } from "../lib/gpsAttemptLedger";
import { assessGpsPrecision } from "../lib/gpsPrecision";
import {appendGpsQualitySample,type GpsQualitySample} from "../lib/gpsQualityIntelligence";
export { shouldTransmitLocation, validLocation, shouldAttemptFreshLocation } from "../lib/gpsAttemptLedger";

type Args = { enabled:boolean; teamId:number|null|undefined; organizationId:number|null; onAccessRevoked?:()=>void };
export function useFieldLocation({enabled,teamId,organizationId,onAccessRevoked}:Args) {
  const [status,setStatus]=useState<"idle"|"requesting"|"sharing"|"error">("idle");
  const [message,setMessage]=useState("");
  // Quality only: never store or expose coordinates outside the guarded API call.
  const [accuracyMeters,setAccuracyMeters]=useState<number|null>(null);
  const [measuredAt,setMeasuredAt]=useState<number|null>(null);
  const [qualityHistory,setQualityHistory]=useState<GpsQualitySample[]>([]);
  // Never persist positions, location permission or geolocation state.
  const requestRef=useRef(0);
  // Volatile across GPS toggle, reconnection and foreground effect restarts.
  const attemptLedger=useRef(new GpsAttemptLedger()).current;
  useEffect(()=>{
    const generation=++requestRef.current;
    if (!enabled || !teamId || !organizationId) {
      setStatus("idle"); setMessage("");
      setAccuracyMeters(null);setMeasuredAt(null);setQualityHistory([]);
      return;
    }
    let stopped=false;
    let watchId:string|undefined;
    let sending=false;
    setStatus("requesting");
    setMessage("Solicitando permissão de localização...");
    setAccuracyMeters(null);setMeasuredAt(null);setQualityHistory([]);
    const stop=()=>stopped || requestRef.current!==generation;
    void Geolocation.watchPosition({ enableHighAccuracy:true, timeout:20_000, maximumAge:10_000 },(position,error)=>{
      if(stop()) return;
      if(error){
        setAccuracyMeters(null);setMeasuredAt(null);
        setStatus("error");setMessage(error.message ?? "GPS indisponível.");return;
      }
      if(!position)return;
      const now=Date.now();
      const point={
        latitude:position.coords.latitude,
        longitude:position.coords.longitude,
        accuracy:position.coords.accuracy,
        timestamp:position.timestamp,
      };
      if(!isRecentLocationSample(point,now)){
        setAccuracyMeters(null);setMeasuredAt(null);
        setStatus("error");
        setMessage("Localização inválida ou antiga; posição não enviada.");
        return;
      }
      const precision=assessGpsPrecision(point.accuracy);
      // Store quality only in volatile memory, never the underlying coordinates.
      setQualityHistory(previous=>appendGpsQualitySample(previous,{
        accuracyMeters:point.accuracy,capturedAt:point.timestamp
      },now));
      setAccuracyMeters(typeof point.accuracy==="number" && Number.isFinite(point.accuracy) && point.accuracy>=0
        ? point.accuracy : null);
      setMeasuredAt(point.timestamp);
      if(!precision.operational || !validLocation(point,now)){
        setStatus("error");
        setMessage(precision.level==="unreliable"
          ? "Precisão acima de 250 m: posição não enviada. Tente uma área aberta e aguarde um sinal melhor."
          : "Precisão do GPS indisponível: posição não enviada.");
        return;
      }
      // Record an ATTEMPT across re-mounted watchers. A timeout or revoked
      // watcher must not cause the same GNSS fix to be sent again.
      if(sending || !attemptLedger.beginAttempt(organizationId,teamId,point,now))return;
      sending=true;
      void api.recordPosition(organizationId,teamId,{
        latitude:point.latitude,longitude:point.longitude,
        accuracyMeters:point.accuracy,capturedAt:new Date(point.timestamp),
      }).then(()=>{
        if(stop())return;
        setStatus("sharing");
        setMessage("Posição transmitida às "+new Date().toLocaleTimeString("pt-BR")+".");
      }).catch((cause:unknown)=>{
        if(stop())return;
        setStatus("error");
        if(isAccessRevoked(cause)){
          // Location transport is authenticated too. A 401/403 here must
          // revoke the whole field UI immediately, not await the next poll.
          setMessage("A central revogou as permissões de localização.");
          onAccessRevoked?.();
          return;
        }
        setMessage(cause instanceof Error ? cause.message : "Não foi possível enviar GPS à central.");
      }).finally(()=>{sending=false;});
    }).then(id=>{
      if(stop())void Geolocation.clearWatch({id}).catch(()=>{});
      else watchId=id;
    }).catch((cause:unknown)=>{
      if(stop())return;
      setAccuracyMeters(null);setMeasuredAt(null);
      setStatus("error");
      setMessage(cause instanceof Error?cause.message:"Não foi possível iniciar GPS.");
    });
    return ()=>{
      stopped=true;
      if(watchId)void Geolocation.clearWatch({id:watchId}).catch(()=>{});
      setStatus("idle");
    };
  },[enabled,teamId,organizationId,onAccessRevoked]);
  return {status,message,accuracyMeters,measuredAt,qualityHistory};
}
