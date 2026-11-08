import {afterEach,describe,expect,it,vi} from "vitest";
import superjson from "superjson";
import {Capacitor} from "@capacitor/core";
import {api} from "./api";
import {isValidTenantSelection} from "./tenantSelectionValidation";

const orgA={id:2,code:"ORG-2",name:"Organização A (fictícia)"};
const orgB={id:3,code:"ORG-3",name:"Organização B (fictícia)"};
const multiple={organizations:[orgA,orgB],activeOrganizationId:null,requiresSelection:true};
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe("tenant.selection — consumer-driven authorization DTO",()=>{
  it.each([
    ["unexpected token", {...multiple,accessToken:"SECRET"}],
    ["organization extra secret",{...multiple,organizations:[{...orgA,privateKey:"SECRET"},orgB]}],
    ["duplicate codes",{...multiple,organizations:[orgA,{...orgB,code:orgA.code}]}],
  ])("refuses unknown/ambiguous selection: %s",(_name,value)=>{
    expect(isValidTenantSelection(value)).toBe(false);
  });

  it.each([
    ["zero orgs",{organizations:[],activeOrganizationId:null,requiresSelection:false}],
    ["one active org",{organizations:[orgA],activeOrganizationId:2,requiresSelection:false}],
    ["two requiring selection",multiple],
    ["two with selection",{...multiple,activeOrganizationId:3,requiresSelection:false}],
  ])("accepts actual backend contract: %s",(_label,value)=>{
    expect(isValidTenantSelection(value)).toBe(true);
  });
  it.each([
    ["null",null],
    ["array",[]],
    ["no organizations",{activeOrganizationId:2,requiresSelection:false}],
    ["no requiresSelection",{organizations:[orgA],activeOrganizationId:2}],
    ["wrong requires",{...multiple,requiresSelection:false}],
    ["forged active tenant",{...multiple,activeOrganizationId:999,requiresSelection:false}],
    ["single org not active",{organizations:[orgA],activeOrganizationId:null,requiresSelection:false}],
    ["empty with active",{organizations:[],activeOrganizationId:2,requiresSelection:false}],
    ["duplicate ids",{organizations:[orgA,{...orgA,code:"NEW"}],activeOrganizationId:null,requiresSelection:true}],
    ["unsafe id",{organizations:[{...orgA,id:Number.MAX_SAFE_INTEGER+1}],activeOrganizationId:null,requiresSelection:false}],
    ["fractional id",{organizations:[{...orgA,id:1.5}],activeOrganizationId:null,requiresSelection:false}],
    ["bad code",{organizations:[{...orgA,code:""}],activeOrganizationId:null,requiresSelection:false}],
    ["control name",{organizations:[{...orgA,name:"foo\nbar"}],activeOrganizationId:null,requiresSelection:false}],
    ["overlong name",{organizations:[{...orgA,name:"X".repeat(181)}],activeOrganizationId:null,requiresSelection:false}],
    ["wrong flags",{organizations:[orgA],activeOrganizationId:2,requiresSelection:"false"}],
    ["bad number",{organizations:[orgA],activeOrganizationId:NaN,requiresSelection:false}],
    ["too many",{organizations:Array.from({length:501},(_,i)=>({...orgA,id:i+1})),activeOrganizationId:null,requiresSelection:true}]
  ])("refuses a malformed/unsafe tenant DTO: %s",(_label,value)=>{
    expect(isValidTenantSelection(value)).toBe(false);
  });
  it("accepts the actual SuperJSON HTTP response on HTTPS and no persisted credentials",async()=>{
    vi.stubGlobal("window",{location:{origin:"https://central.example.invalid"}});
    vi.spyOn(Capacitor,"isNativePlatform").mockReturnValue(false);
    const fetchMock=vi.fn().mockResolvedValue({
      ok:true,status:200,json:async()=>({result:{data:superjson.serialize(multiple)}})
    });
    vi.stubGlobal("fetch",fetchMock);
    await expect(api.tenant()).resolves.toEqual(multiple);
    const [url,options]=fetchMock.mock.calls[0] as [string,RequestInit];
    expect(new URL(url).pathname).toBe("/api/trpc/tenant.selection");
    expect(new URL(url).searchParams.has("input")).toBe(true);
    expect(options.credentials).toBe("include");
    expect(options.redirect).toBe("error");
    expect(options.method).toBe("GET");
    expect(options.body).toBeUndefined();
    expect((options.headers as Record<string,string>)["x-organization-id"]).toBeUndefined();
  });
  it("refuses a successful-HTTP response containing a forged organization ID",async()=>{
    vi.stubGlobal("window",{location:{origin:"https://central.example.invalid"}});
    vi.spyOn(Capacitor,"isNativePlatform").mockReturnValue(false);
    const fetchMock=vi.fn().mockResolvedValue({
      ok:true,status:200,
      json:async()=>({result:{data:superjson.serialize({...multiple,activeOrganizationId:666,requiresSelection:false})}})
    });
    vi.stubGlobal("fetch",fetchMock);
    await expect(api.tenant()).rejects.toMatchObject({code:"INVALID_TENANT_SELECTION"});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([401,403])("keeps backend denial %s instead of turning into selection state",async status=>{
    vi.stubGlobal("window",{location:{origin:"https://central.example.invalid"}});
    vi.spyOn(Capacitor,"isNativePlatform").mockReturnValue(false);
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({
      ok:false,status,json:async()=>({error:{message:"Acesso negado"}})
    }));
    await expect(api.tenant()).rejects.toMatchObject({code:String(status)});
  });
  it("never connects to backend from native WebView",async()=>{
    vi.stubGlobal("window",{location:{origin:"capacitor://localhost"}});
    vi.spyOn(Capacitor,"isNativePlatform").mockReturnValue(true);
    const fetchMock=vi.fn();
    vi.stubGlobal("fetch",fetchMock);
    await expect(api.tenant()).rejects.toMatchObject({code:"NATIVE_AUTH_PENDING"});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
