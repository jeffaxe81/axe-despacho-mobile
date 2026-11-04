import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect, useRef, useState } from "react";

/**
 * Android first: reset operational permission whenever the Activity is paused.
 * Resume never restores GPS sharing or the last validated assignment state.
 */
export function shouldRevokeOnAppStateChange(active:boolean):boolean {
  return !active;
}

export function useForegroundLifecycle(onBackground:()=>void):boolean {
  const [foreground,setForeground]=useState(()=>typeof document==="undefined" || document.visibilityState!=="hidden");
  const callback=useRef(onBackground);
  callback.current=onBackground;
  useEffect(()=>{
    let disposed=false;
    const apply=(active:boolean)=>{
      if(disposed)return;
      setForeground(active);
      if(shouldRevokeOnAppStateChange(active)) callback.current();
    };
    const visibility=()=>apply(document.visibilityState!=="hidden");
    document.addEventListener("visibilitychange",visibility);
    let listener: {remove:()=>Promise<void>}|undefined;
    if(Capacitor.isNativePlatform()){
      void App.addListener("appStateChange",({isActive})=>apply(isActive))
        .then(handle=>{
          if(disposed) void handle.remove().catch(()=>{});
          else listener=handle;
        })
        .catch(()=>{callback.current();setForeground(false);});
    }
    return()=>{
      disposed=true;
      document.removeEventListener("visibilitychange",visibility);
      if(listener)void listener.remove().catch(()=>{});
    };
  },[]);
  return foreground;
}
