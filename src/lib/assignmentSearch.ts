import type { AssignmentRow } from "./contracts";

/** The filters are *presentation-only*. They never replace the authorized
 * server snapshot, activeCount, permissions or command/GPS eligibility.
 */
export type AssignmentViewFilter = "all"|"dispatched"|"active"|"finished";
const ACTIVE = new Set(["aceita","em_atendimento","pausada"]);
const FINISHED = new Set(["concluida","cancelada"]);
export const MAX_ASSIGNMENT_QUERY_CHARS = 80;

function normalize(text:string):string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
}
export function filterLoadedAssignments(
  rows:readonly AssignmentRow[],
  query:string,
  view:AssignmentViewFilter
):AssignmentRow[] {
  const safeQuery=normalize(query.trim().slice(0,MAX_ASSIGNMENT_QUERY_CHARS));
  return rows.filter(({incident})=>{
    const byStatus=view==="all" || (view==="dispatched"&&incident.status==="despachada") ||
      (view==="active"&&ACTIVE.has(incident.status)) ||
      (view==="finished"&&FINISHED.has(incident.status));
    if(!byStatus)return false;
    if(!safeQuery)return true;
    // Do not search or persist description/address/coordinates; minimize PII.
    return normalize(incident.code).includes(safeQuery) ||
      normalize(incident.category).includes(safeQuery);
  });
}
