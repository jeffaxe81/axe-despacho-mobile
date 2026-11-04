import { Geolocation } from "@capacitor/geolocation";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

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
type Args = { enabled:boolean; teamId:number|null|undefined; organizationId:number|null; };
export function useFieldLocation({enabled,teamId,organizationId}:Args) {
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
    let lastSentAt=0;
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
      if(!shouldTransmitLocation(lastSentAt,now) || sending)return;
      // lastSentAt is only advanced on successful transmission; do not replay
      // queued GPS points or accept a previous sample after a failed request.
      sending=true;
      void api.recordPosition(organizationId,teamId,{
        latitude:point.latitude,longitude:point.longitude,
        accuracyMeters:point.accuracy,capturedAt:new Date(point.timestamp),
      }).then(()=>{
        if(stop())return;
        lastSentAt=Date.now();
        setStatus("sharing");
        setMessage("Posição transmitida às "+new Date().toLocaleTimeString("pt-BR")+".");
      }).catch((cause:unknown)=>{
        if(stop())return;
        setStatus("error");
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
  },[enabled,teamId,organizationId]);
  return {status,message};
}
