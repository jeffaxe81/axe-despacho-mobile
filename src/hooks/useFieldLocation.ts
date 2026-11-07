import { Geolocation } from "@capacitor/geolocation";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { isAccessRevoked } from "../lib/sessionAccess";
import { GpsAttemptLedger, validLocation } from "../lib/gpsAttemptLedger";
export { shouldTransmitLocation, validLocation, shouldAttemptFreshLocation } from "../lib/gpsAttemptLedger";

type Args = { enabled:boolean; teamId:number|null|undefined; organizationId:number|null; onAccessRevoked?:()=>void };
export function useFieldLocation({enabled,teamId,organizationId,onAccessRevoked}:Args) {
  const [status,setStatus]=useState<"idle"|"requesting"|"sharing"|"error">("idle");
  const [message,setMessage]=useState("");
  // Never persist positions, location permission or geolocation state.
  const requestRef=useRef(0);
  // Volatile across GPS toggle, reconnection and foreground effect restarts.
  const attemptLedger=useRef(new GpsAttemptLedger()).current;
  useEffect(()=>{
    const generation=++requestRef.current;
    if (!enabled || !teamId || !organizationId) {
      setStatus("idle"); setMessage("");
      return;
    }
    let stopped=false;
    let watchId:string|undefined;
    let sending=false;
    setStatus("requesting");
    setMessage("Solicitando permissão de localização...");
    const stop=()=>stopped || requestRef.current!==generation;
    void Geolocation.watchPosition({ enableHighAccuracy:true, timeout:20_000, maximumAge:10_000 },(position,error)=>{
      if(stop()) return;
      if(error){setStatus("error");setMessage(error.message ?? "GPS indisponível.");return;}
      if(!position)return;
      const now=Date.now();
      const point={
        latitude:position.coords.latitude,
        longitude:position.coords.longitude,
        accuracy:position.coords.accuracy,
        timestamp:position.timestamp,
      };
      if(!validLocation(point,now)){
        setStatus("error");
        setMessage("Coordenada ausente, imprecisa ou antiga; posição não enviada.");
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
      setStatus("error");
      setMessage(cause instanceof Error?cause.message:"Não foi possível iniciar GPS.");
    });
    return ()=>{
      stopped=true;
      if(watchId)void Geolocation.clearWatch({id:watchId}).catch(()=>{});
      setStatus("idle");
    };
  },[enabled,teamId,organizationId,onAccessRevoked]);
  return {status,message};
}
