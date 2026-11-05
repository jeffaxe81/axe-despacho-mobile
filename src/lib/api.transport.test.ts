import {afterEach,describe,expect,it,vi} from "vitest";
import superjson from "superjson";
import {Capacitor} from "@capacitor/core";
import {api,ApiError} from "./api";

afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe("authenticated field queries",()=>{
  const prepare=(origin="https://central.example")=>{
    vi.stubGlobal("window",{location:{origin}});
    vi.spyOn(Capacitor,"isNativePlatform").mockReturnValue(false);
  };
  it("uses same-origin cookie, tenant-scoped read and SuperJSON",async()=>{
    prepare();
    const fetchMock=vi.fn().mockResolvedValue({
      ok:true,status:200,json:async()=>({result:{data:superjson.serialize({rows:[],total:0})}})
    });
    vi.stubGlobal("fetch",fetchMock);
    expect(await api.assignments(8)).toEqual({rows:[],total:0});
    const [url,options]=fetchMock.mock.calls[0] as [string,RequestInit];
    expect(new URL(url).origin).toBe("https://central.example");
    expect(new URL(url).pathname).toBe("/api/trpc/incidents.list");
    expect((options.headers as Record<string,string>)["x-organization-id"]).toBe("8");
    expect(options.credentials).toBe("include");
  });
  it.each(["http://central.example","http://192.168.1.50:5173","file://"])(
    "refuses cookie-backed API over insecure origin %s before network access",async(origin)=>{
      prepare(origin);
      const fetchMock=vi.fn();
      vi.stubGlobal("fetch",fetchMock);
      await expect(api.login("agent","example-password")).rejects.toMatchObject({code:"INSECURE_TRANSPORT"});
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );
  it.each(["http://localhost:5173","http://127.0.0.1:5173","http://[::1]:5173"])(
    "allows loopback HTTP strictly for local development: %s",async(origin)=>{
      prepare(origin);
      const fetchMock=vi.fn().mockResolvedValue({
        ok:true,status:200,json:async()=>({result:{data:superjson.serialize(null)}})
      });
      vi.stubGlobal("fetch",fetchMock);
      await expect(api.me()).resolves.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect((fetchMock.mock.calls[0][1] as RequestInit).redirect).toBe("error");
    }
  );
  it("rejects automatic redirects of credential-bearing login requests",async()=>{
    prepare();
    const fetchMock=vi.fn().mockResolvedValue({
      ok:true,status:200,json:async()=>({result:{data:superjson.serialize({})}})
    });
    vi.stubGlobal("fetch",fetchMock);
    await api.login("agent","example-password");
    const [url,options]=fetchMock.mock.calls[0] as [string,RequestInit];
    expect(new URL(url).origin).toBe("https://central.example");
    expect(options.credentials).toBe("include");
    expect(options.redirect).toBe("error");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("does not retry a rejected redirect or ambiguous HTTP failure",async()=>{
    prepare();
    const fetchMock=vi.fn().mockRejectedValue(new TypeError("fetch redirect rejected"));
    vi.stubGlobal("fetch",fetchMock);
    await expect(api.login("agent","example-password")).rejects.toMatchObject({code:"NETWORK_ERROR"});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1] as RequestInit).redirect).toBe("error");
  });
  it("sends a team active-status filter supported by the central",async()=>{
    prepare();
    const fetchMock=vi.fn().mockResolvedValue({
      ok:true,status:200,json:async()=>({result:{data:superjson.serialize({rows:[],total:0})}})
    });
    vi.stubGlobal("fetch",fetchMock);
    await api.assignments(8,undefined,"pausada");
    const [url,options]=fetchMock.mock.calls[0] as [string,RequestInit];
    const input=superjson.deserialize<Record<string,unknown>>(
      JSON.parse(new URL(url).searchParams.get("input")!)
    );
    expect(input).toEqual({page:1,pageSize:50,status:"pausada"});
    expect((options.headers as Record<string,string>)["x-organization-id"]).toBe("8");
  });
  it.each([0,1,2])("follows the central's positive-only status revision input: %s",async(revision)=>{
    prepare();
    const fetchMock=vi.fn().mockResolvedValue({
      ok:true,status:200,json:async()=>({result:{data:superjson.serialize({})}})
    });
    vi.stubGlobal("fetch",fetchMock);
    await api.transition(8,100,"aceita","em_atendimento","Equipe assumiu",revision);
    const [url,options]=fetchMock.mock.calls[0] as [string,RequestInit];
    expect(new URL(url).pathname).toBe("/api/trpc/incidents.transition");
    const input=superjson.deserialize<Record<string,unknown>>(JSON.parse(options.body as string));
    if(revision===0)expect(input).not.toHaveProperty("expectedStatusRevision");
    else expect(input.expectedStatusRevision).toBe(revision);
  });
  it("cancels queries before sending anything if switching tenant",async()=>{
    prepare();
    const fetchMock=vi.fn();
    vi.stubGlobal("fetch",fetchMock);
    const controller=new AbortController();controller.abort();
    await expect(api.assignments(8,controller.signal)).rejects.toMatchObject({code:"ABORTED"});
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([401,403])("preserves HTTP %s when structured tRPC code is missing",async(status)=>{
    prepare();
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({
      ok:false,status,json:async()=>({error:{message:"Acesso negado"}})
    }));
    await expect(api.assignments(8)).rejects.toMatchObject({code:String(status)});
  });
  it.each([401,403])("revokes access on HTTP %s even with unparseable body",async(status)=>{
    prepare();
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({
      ok:false,status,json:async()=>{throw new SyntaxError("unexpected response");}
    }));
    await expect(api.assignments(8)).rejects.toMatchObject({code:String(status)});
  });
  it("prefers HTTP authentication denial over an inconsistent RPC body",async()=>{
    prepare();
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({
      ok:false,status:401,
      json:async()=>({error:{message:"Acesso negado",json:{data:{code:"RPC_ERROR"}}}})
    }));
    await expect(api.assignments(8)).rejects.toMatchObject({code:"401"});
  });
  it("rejects a malformed 200 response instead of trusting it",async()=>{
    prepare();
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({
      ok:true,status:200,json:async()=>null
    }));
    await expect(api.assignments(8)).rejects.toMatchObject({code:"INVALID_RESPONSE"});
  });
  it("returns a controlled network error, never a queued write",async()=>{
    prepare();
    vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(api.assignments(8)).rejects.toMatchObject({code:"NETWORK_ERROR"});
    expect(new ApiError("x","UNKNOWN").name).toBe("ApiError");
  });
});
