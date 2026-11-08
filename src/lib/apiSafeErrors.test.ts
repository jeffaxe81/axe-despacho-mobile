import {afterEach,describe,expect,it,vi} from "vitest";
import {Capacitor} from "@capacitor/core";
import {api} from "./api";
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe("Frente 09 — mensagens de API sem segredos nem dados de outro tenant",()=>{
  it.each([
    [401,"401","Sessão expirada"],
    [403,"403","Acesso não autorizado"],
    [500,"SERVER_ERROR","falha temporária"],
    [503,"SERVER_ERROR","falha temporária"],
  ] as const)("redige resposta HTTP %s e não repete a requisição",async(status,code,message)=>{
    vi.stubGlobal("window",{location:{origin:"https://central.example"}});
    vi.spyOn(Capacitor,"isNativePlatform").mockReturnValue(false);
    const fetchMock=vi.fn().mockResolvedValue({
      ok:false,status,
      json:async()=>({error:{json:{message:"SECRET user=42 org=99 token=abc",data:{code:"FORBIDDEN"}}}}),
    });
    vi.stubGlobal("fetch",fetchMock);
    let captured:unknown;
    try{await api.respond(10,123,true);}catch(error){captured=error;}
    expect(captured).toMatchObject({code});
    expect((captured as Error).message).toContain(message);
    expect((captured as Error).message).not.toMatch(/SECRET|token|org=99|user=42/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
