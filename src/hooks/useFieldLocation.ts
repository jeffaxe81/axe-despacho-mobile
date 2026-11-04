import { Geolocation } from "@capacitor/geolocation";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { isAccessRevoked } from "../lib/sessionAccess";

const INTERVAL_MS = 20_000;
const MAX_ACCURACY_METERS = 500; // dispatch safety threshold, reject imprecise GPS
const MAX_AGE_MS = 30_000;

export function shouldTransmitLocation(lastSentAt:number, now:number) {
  return Number.isFinite(now) && now>=0 && (lastSentAt===0 || (now>=lastSentAt && now-lastSentAt>=INTERVAL_MS));
}
export function validLocation(position:{ latitude:number; longitude:number; accuracy:number; timestamp:number }, now:number) {
  return Number.isFinite(position.latitude) && Math.abs(position.latitude)<=90 &&
    Number.isFinite(position.longitude) && Math.abs(position.longitude)<=180 &&
    Number.isFinite(position.accuracy) && position.accuracy>=0 && position.accuracy<=MAX_ACCURACY_METERS &&
    Number.isFinite(position.timestamp) && position.timestamp<=now && now-position.timestamp<=MAX_AGE_MS;
}

/**
 * Gate each GPS write by freshness, strictly increasing sample time and a
 * minimum delay between ATTEMPTS (not only successful uploads). On a timeout
 * a previous write may have reached the server, so never resend that sample.
 */
export function shouldAttemptFreshLocation(
  lastAttemptAt: number | null,
  lastAttemptFixAt: number | null,
  point: { latitude:number; longitude:number; accuracy:number; timestamp:number },
  now: number
): boolean {
  if (!validLocation(point,now)) return false;
  if (lastAttemptFixAt !== null &&
      (!Number.isFinite(lastAttemptFixAt) || point.timestamp <= lastAttemptFixAt)) return false;
  if (lastAttemptAt === null) return true;
  return Number.isFinite(lastAttemptAt) && lastAttemptAt >= 0 &&
    now >= lastAttemptAt && now-lastAttemptAt >= INTERVAL_MS;
}
type Args = { enabled:boolean; teamId:number|null|undefined; organizationId:number|null; onAccessRevoked?:()=>void };
export function useFieldLocation({enabled,teamId,organizationId,onAccessRevoked}:Args) {
  const [status,setStatus]=useState<"idle"|"requesting"|"sharing"|"error">("idle");
  const [message,setMessage]=useState("");
  // Never persist positions, location permission or geolocation state.
  const requestRef=useRef(0);
  useEffect(()=>{
    const generation=++requestRef.current;
    if (!enabled || !teamId || !organizationId) {
      setStatus("idle"); setMessage("");
      return;
    }
    let stopped=false;
    let watchId:string|undefined;
    let lastAttemptAt:number|null=null;
    let lastAttemptFixAt:number|null=null;
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
      if(sending || !shouldAttemptFreshLocation(lastAttemptAt,lastAttemptFixAt,point,now))return;
      // Record an ATTEMPT before any request. An uncertain network outcome
      // never queues or automatically repeats the same captured GPS sample.
      lastAttemptAt=now;
      lastAttemptFixAt=point.timestamp;
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
