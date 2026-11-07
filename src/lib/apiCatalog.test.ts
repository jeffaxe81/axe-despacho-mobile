import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import catalog from "../../docs/api/mobile-api-catalog.json";

describe("Mobile public API catalog — explicit status, no phantom endpoints",()=>{
  it("contains all mobile tRPC procedures and locates tenant selection in composed router",()=>{
    const names=catalog.procedures.map(p=>p.procedure);
    const required=["auth.me","auth.login","auth.logout","tenant.selection","access.me",
      "incidents.list","incidents.respondToAssignment","incidents.transition","teams.recordLocation"];
    for(const name of required)expect(names).toContain(name);
    expect(new Set(names).size).toBe(names.length);
    expect(catalog.procedures.find(p=>p.procedure==="tenant.selection")?.availability)
      .toBe("implemented_in_composed_runtime_router");
  });
  it("never advertises operational public REST or native auth",()=>{
    expect(catalog.public_rest_gateway_available).toBe(false);
    expect(catalog.operational_native_auth_available).toBe(false);
    expect(catalog.open_anonymous_api_available).toBe(false);
    expect(catalog.proposed_public_api.state).toBe("proposal_only_not_deployed");
  });
  it("matches current mobile tRPC code names without inventing production routes",()=>{
    const apiSource=readFileSync("src/lib/api.ts","utf8");
    for(const procedure of catalog.procedures.filter(p=>p.client==="web-same-origin"||p.client==="mobile_expects_it")){
      expect(apiSource).toContain('"'+procedure.procedure+'"');
    }
    const proposal=readFileSync("docs/api/openapi-external-proposal.yaml","utf8");
    expect(proposal).toContain("x-implementation-status: proposal-only-not-deployed");
    expect(proposal).toContain("https://api.example.invalid");
    expect(proposal).toContain("OAuth2:");
    expect(proposal).toContain("Idempotency-Key");
  });
  it("does not conflate simulated OpenAPI catalog with partner API",()=>{
    expect(catalog.procedures.find(p=>p.procedure==="integrations.openapi.internal")?.access)
      .toContain("simulated/internal");
    expect(catalog.proposed_public_api.security).toContain("Tenant/team/actor server authorization");
  });
});
