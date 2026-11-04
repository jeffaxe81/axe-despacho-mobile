import {afterEach,describe,expect,it,vi} from "vitest";
import superjson from "superjson";
import {Capacitor} from "@capacitor/core";
import {api,ApiError} from "./api";

afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe("authenticated field queries",()=>{
  const prepare=()=>{
    vi.stubGlobal("window",{location:{origin:"https://central.example"}});
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
  it("cancels queries before sending anything if switching tenant",async()=>{
    prepare();
    const fetchMock=vi.fn();
    vi.stubGlobal("fetch",fetchMock);
    const controller=new AbortController();controller.abort();
    await expect(api.assignments(8,controller.signal)).rejects.toMatchObject({code:"ABORTED"});
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns a controlled network error, never a queued write",async()=>{
    prepare();
    vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(api.assignments(8)).rejects.toMatchObject({code:"NETWORK_ERROR"});
    expect(new ApiError("x","UNKNOWN").name).toBe("ApiError");
  });
});
