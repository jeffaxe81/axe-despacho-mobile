import type {TenantSelection} from "./contracts";

const MAX_ORGANIZATIONS=500;
const MAX_ORG_CODE=80;
const MAX_ORG_NAME=180;
const CONTROL=/[\u0000-\u001f\u007f]/;

function record(value:unknown):value is Record<string,unknown>{
  return value!==null && typeof value==="object" && !Array.isArray(value);
}
function validLabel(value:unknown,max:number):value is string{
  return typeof value==="string" &&
    value.trim().length>0 && value.length<=max && !CONTROL.test(value);
}
const id=(value:unknown):value is number=>
  typeof value==="number" && Number.isSafeInteger(value) && value>0;

/**
 * Defend against an incomplete/malformed tRPC DTO before ever granting a
 * tenant-dependent field session. The central remains the authority on
 * authorization and must independently validate the x-organization-id header.
 */
export function isValidTenantSelection(value:unknown):value is TenantSelection{
  if(!record(value)||Object.keys(value).sort().join(",")!=="activeOrganizationId,organizations,requiresSelection"||
     !Array.isArray(value.organizations)||
     value.organizations.length>MAX_ORGANIZATIONS||
     (value.activeOrganizationId!==null&&!id(value.activeOrganizationId))||
     typeof value.requiresSelection!=="boolean")return false;
  const seen=new Set<number>();
  const codes=new Set<string>();
  for(const organization of value.organizations){
    if(!record(organization)||
       Object.keys(organization).sort().join(",")!=="code,id,name"||
       !id(organization.id)||
       !validLabel(organization.code,MAX_ORG_CODE)||
       !validLabel(organization.name,MAX_ORG_NAME)||
       seen.has(organization.id)||codes.has(organization.code))return false;
    seen.add(organization.id);
    codes.add(organization.code);
  }
  if(value.activeOrganizationId!==null&&!seen.has(value.activeOrganizationId))return false;
  const expectedRequires=value.organizations.length>1 && value.activeOrganizationId===null;
  if(value.requiresSelection!==expectedRequires)return false;
  // In the central's current contract, one eligible organization is
  // automatically active; zero eligible organizations cannot be active.
  if(value.organizations.length===1 &&
     value.activeOrganizationId!==value.organizations[0].id)return false;
  if(value.organizations.length===0 && value.activeOrganizationId!==null)return false;
  return true;
}
