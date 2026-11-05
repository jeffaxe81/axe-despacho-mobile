import { ApiError } from "./api";
import { validateAssignmentResult } from "./assignmentValidation";
import type { AssignmentResult, AssignmentRow } from "./contracts";

export const FIELD_ACTIVE_STATUSES = ["aceita", "em_atendimento", "pausada"] as const;
export type FieldActiveStatus = typeof FIELD_ACTIVE_STATUSES[number];
export type TeamSnapshot = AssignmentResult & { activeCount: number };
export type FetchAssignments = (status?:FieldActiveStatus, signal?:AbortSignal)=>Promise<unknown>;

function invalid(reason:string): never {
  throw new ApiError(reason,"INCONSISTENT_TEAM_SNAPSHOT");
}
function sameIncident(a:AssignmentRow,b:AssignmentRow):boolean {
  const x=a.incident,y=b.incident;
  // A concurrent update of details, not only the status, can leave a
  // misleading view of an incident's address/category/priority. Treat any
  // mismatch within the returned first-page overlap as an unverified read.
  return x.id===y.id && x.status===y.status && x.statusRevision===y.statusRevision &&
    x.assignedTeamId===y.assignedTeamId && x.code===y.code &&
    x.priority===y.priority && x.category===y.category &&
    x.address===y.address && x.description===y.description;
}

/**
 * The first unfiltered page can contain 50 closed/historical incidents while
 * another active incident is on page 2+. Check separate server-side status
 * totals for ALL three active states before enabling operations or GPS.
 *
 * This is a guarded read, NOT a transactionally consistent server snapshot:
 * mismatched counts/versions found across calls fail closed. Backend-supplied
 * snapshot revisions are a future requirement for strict atomic consistency.
 */
export async function loadVerifiedTeamSnapshot(
  teamId:number|null|undefined,
  fetchAssignments:FetchAssignments,
  signal?:AbortSignal
):Promise<TeamSnapshot> {
  if(signal?.aborted)throw new ApiError("Consulta cancelada.","ABORTED");
  const [rawMain,...rawActive]=await Promise.all([
    fetchAssignments(undefined,signal),
    ...FIELD_ACTIVE_STATUSES.map(status=>fetchAssignments(status,signal))
  ]);
  if(signal?.aborted)throw new ApiError("Consulta cancelada.","ABORTED");

  const main=validateAssignmentResult(rawMain,teamId);
  if(main.rows.length !== Math.min(50,main.total)){
    invalid("A central devolveu uma primeira página incompleta da equipe.");
  }
  const statuses=rawActive.map((payload,index)=>{
    const verified=validateAssignmentResult(payload,teamId);
    const expected=FIELD_ACTIVE_STATUSES[index];
    if(verified.rows.some(row=>row.incident.status!==expected)) {
      invalid("A central misturou situações de ocorrências no filtro ativo.");
    }
    // A first page of at most 50 cannot be short unless the result count
    // actually matches; otherwise the central's pagination is inconsistent.
    if(verified.rows.length !== Math.min(50,verified.total)){
      invalid("A central devolveu uma página incompleta de ocorrências ativas.");
    }
    return verified;
  });
  const activeCount=statuses.reduce((acc,p)=>acc+p.total,0);
  if(!Number.isSafeInteger(activeCount) || activeCount>main.total){
    invalid("Quantidade de ocorrências ativas excede o total da equipe.");
  }

  const activeRows=statuses.flatMap(p=>p.rows);
  const activeIndex=new Map<number,AssignmentRow>();
  for(const row of activeRows){
    if(activeIndex.has(row.incident.id))invalid("Ocorrência ativa duplicada entre situações.");
    activeIndex.set(row.incident.id,row);
  }
  const seen=new Map(main.rows.map(row=>[row.incident.id,row]));
  // If the whole team fits in one page, filtered active incidents MUST
  // already be present in that same page. A fabricated/stale extra active row
  // cannot be treated as an authorized assignment in this case.
  if(main.total<=50 && activeRows.some(row=>!seen.has(row.incident.id))){
    invalid("Filtro ativo retornou ocorrência ausente da listagem completa da equipe.");
  }
  for(const row of main.rows){
    const filtered=activeIndex.get(row.incident.id);
    if(filtered && !sameIncident(row,filtered)){
      invalid("A ocorrência mudou durante a validação de equipe.");
    }
    if(FIELD_ACTIVE_STATUSES.some(status=>status===row.incident.status) &&
       !filtered && activeCount<=50){
      invalid("Ocorrência ativa não encontrada nos filtros de validação.");
    }
  }
  // Ensure an active incident beyond the first 50 historical rows is
  // visible to the agent, without fabricating/duplicating any assignment.
  const extra=activeRows.filter(row=>!seen.has(row.incident.id));
  const rows=[...extra,...main.rows];
  return {rows,total:main.total,activeCount};
}
