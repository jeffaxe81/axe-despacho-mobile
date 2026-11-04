import { ApiError } from "./api";
import { statuses } from "./contracts";
import type { AssignmentResult } from "./contracts";

const VALID_STATUSES = new Set<string>(statuses);
const VALID_PRIORITIES = new Set<string>(["baixa", "media", "alta", "critica"]);
const MAX_PAGE_SIZE = 50;

function validId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function invalid(message: string): never {
  throw new ApiError(message, "INVALID_ASSIGNMENTS");
}

/**
 * Never grant operational access based only on a TypeScript cast of a network
 * response. Validate the entire page before accepting its freshness timestamp.
 */
export function validateAssignmentResult(payload: unknown, teamId: number | null | undefined): AssignmentResult {
  if (!validId(teamId)) invalid("Equipe do agente não validada.");
  if (!record(payload)) invalid("Resposta de ocorrências inválida.");
  const { rows, total } = payload;
  if (!Array.isArray(rows) || rows.length > MAX_PAGE_SIZE ||
      typeof total !== "number" || !Number.isSafeInteger(total) || total < rows.length) {
    invalid("Paginação de ocorrências inconsistente.");
  }

  const seen = new Set<number>();
  for (const row of rows) {
    if (!record(row) || !record(row.incident)) invalid("Ocorrência incompleta.");
    const incident = row.incident;
    if (!validId(incident.id) || seen.has(incident.id)) invalid("Identificador duplicado ou inválido.");
    seen.add(incident.id);
    if (incident.assignedTeamId !== teamId) {
      throw new ApiError("A central retornou dados fora do escopo da equipe.", "TEAM_SCOPE_MISMATCH");
    }
    if (typeof incident.status !== "string" || !VALID_STATUSES.has(incident.status) ||
        typeof incident.priority !== "string" || !VALID_PRIORITIES.has(incident.priority) ||
        typeof incident.code !== "string" || incident.code.length < 1 || incident.code.length > 120 ||
        typeof incident.category !== "string" ||
        typeof incident.address !== "string" ||
        typeof incident.description !== "string" ||
        (incident.statusRevision !== undefined &&
          (typeof incident.statusRevision !== "number" ||
           !Number.isSafeInteger(incident.statusRevision) || incident.statusRevision < 0))) {
      invalid("Campos da ocorrência incompatíveis com o contrato mobile.");
    }
  }
  return payload as AssignmentResult;
}
