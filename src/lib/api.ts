import superjson from "superjson";
import { Capacitor } from "@capacitor/core";
import type { Access, AssignmentResult, FieldUser, IncidentStatus, TenantSelection } from "./contracts";

export class ApiError extends Error {
  constructor(message:string, public readonly code:string = "UNKNOWN") { super(message); this.name = "ApiError"; }
}
type RpcErrorShape = { message?:string; json?:{ message?:string; data?:{ code?:string } }; data?:{ code?:string } };
type RpcEnvelope = { result?:{data?:unknown}; error?:RpcErrorShape };

/** Fail closed until a server-approved Android authentication flow is implemented. */
export function assertNativeApiAuthenticationReady(isNative: boolean): void {
  if (isNative) throw new ApiError("O login nativo do Android ainda exige um contrato de autenticação seguro na central.", "NATIVE_AUTH_PENDING");
}
function endpoint(path:string):URL {
  assertNativeApiAuthenticationReady(Capacitor.isNativePlatform());
  if (!/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(path)) throw new ApiError("Procedimento de API inválido.");
  const url = new URL("/api/trpc/" + path, window.location.origin);
  const configured = import.meta.env.VITE_DISPATCH_API_BASE?.trim();
  // Existing server session cookies must remain same-origin. Cross-origin
  // native authentication requires a new audited contract, not a CORS bypass.
  if (configured && new URL(configured).origin !== url.origin) {
    throw new ApiError("Autenticação mobile nativa ainda não habilitada na central.", "NATIVE_AUTH_PENDING");
  }
  return url;
}
async function rpc<T>(method:"GET"|"POST",path:string,input?:unknown,organizationId?:number):Promise<T> {
  const url = endpoint(path);
  const serialized = superjson.serialize(input ?? null);
  if (method==="GET") url.searchParams.set("input",JSON.stringify(serialized));
  const headers:Record<string,string> = { "Accept":"application/json" };
  if (method==="POST") headers["Content-Type"]="application/json";
  if (organizationId !== undefined) {
    if (!Number.isSafeInteger(organizationId) || organizationId<1) throw new ApiError("Organização inválida.");
    headers["x-organization-id"]=String(organizationId);
  }
  const response=await fetch(url.toString(),{
    method, headers, credentials:"include",
    ...(method==="POST"?{body:JSON.stringify(serialized)}:{})
  });
  let payload:RpcEnvelope;
  try { payload=await response.json() as RpcEnvelope; }
  catch { throw new ApiError("Resposta inesperada da central. Verifique a origem HTTPS e o proxy."); }
  if (payload.error) {
    throw new ApiError(payload.error.json?.message ?? payload.error.message ?? "Falha na API.",
      payload.error.json?.data?.code ?? payload.error.data?.code ?? "RPC_ERROR");
  }
  if (!response.ok || !payload.result || payload.result.data === undefined) {
    throw new ApiError("Resposta inválida da central.",String(response.status));
  }
  // The central uses initTRPC({ transformer: superjson }); payload.result.data
  // is the SuperJSONResult envelope, not a plain JSON object.
  const data=payload.result.data as ReturnType<typeof superjson.serialize>;
  return superjson.deserialize<T>(data);
}
export const api = {
  me:()=>rpc<FieldUser|null>("GET","auth.me"),
  login:(username:string,password:string)=>rpc<unknown>("POST","auth.login",{username,password}),
  logout:()=>rpc<{success:boolean}>("POST","auth.logout"),
  tenant:()=>rpc<TenantSelection>("GET","tenant.selection"),
  access:()=>rpc<Access>("GET","access.me"),
  assignments:(orgId:number)=>rpc<AssignmentResult>("GET","incidents.list",{page:1,pageSize:50},orgId),
  respond:(orgId:number,incidentId:number,accepted:boolean)=>
    rpc<unknown>("POST","incidents.respondToAssignment",{incidentId,accepted},orgId),
  transition:(orgId:number,incidentId:number,expectedStatus:IncidentStatus,nextStatus:IncidentStatus,note:string,revision?:number)=>
    rpc<unknown>("POST","incidents.transition",{
      incidentId,expectedStatus,nextStatus,note,...(revision?{expectedStatusRevision:revision}:{})
    },orgId),
  recordPosition:(orgId:number,teamId:number,position:{latitude:number;longitude:number;accuracyMeters?:number;capturedAt:Date})=>
    rpc<unknown>("POST","teams.recordLocation",{teamId,...position},orgId)
};
