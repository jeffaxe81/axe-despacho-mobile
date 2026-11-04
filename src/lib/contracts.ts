/** DTOs used by the mobile client. Keep in sync with the central's tRPC API.
 * Do not import the server runtime or database into this mobile repo.
 */
export const statuses = ["triagem", "aguardando_despacho", "despachada", "aceita", "em_atendimento", "pausada", "concluida", "cancelada"] as const;
export type IncidentStatus = typeof statuses[number];
export type Priority = "baixa" | "media" | "alta" | "critica";
export type FieldUser = { id:number; name:string; operationalRole:string; teamId:number|null; active:boolean };
export type Organization = { id:number; name:string; code:string };
export type TenantSelection = { organizations:Organization[]; activeOrganizationId:number|null; requiresSelection:boolean };
export type Access = { permissions:string[] };
export type Incident = {
  id:number; code:string; status:IncidentStatus; priority:Priority;
  category:string; address:string; description:string;
  assignedTeamId:number|null; statusRevision?:number;
};
export type AssignmentRow = { incident:Incident };
export type AssignmentResult = { rows:AssignmentRow[]; total:number };
export const statusLabels: Record<IncidentStatus,string> = {
  triagem:"Em triagem", aguardando_despacho:"Aguardando despacho", despachada:"Despachada",
  aceita:"Aceita", em_atendimento:"Em atendimento", pausada:"Pausada",
  concluida:"Concluída", cancelada:"Cancelada"
};
export function activeAssigned(rows: readonly AssignmentRow[]): AssignmentRow[] {
  return rows.filter(row=>["aceita","em_atendimento","pausada"].includes(row.incident.status));
}
export function isFieldUser(user:FieldUser|null, access:Access|null, orgId:number|null): boolean {
  return Boolean(user?.active && user.operationalRole==="agente" && user.teamId && orgId &&
    access?.permissions.includes("occurrences.view") && access.permissions.includes("occurrences.transition"));
}
