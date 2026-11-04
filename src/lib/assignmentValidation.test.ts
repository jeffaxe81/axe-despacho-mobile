import { describe, expect, it } from "vitest";
import { validateAssignmentResult } from "./assignmentValidation";

const fixture = () => ({
  rows: [{
    incident: {
      id: 10, code: "OCO-10", status: "despachada", priority: "alta",
      category: "Atendimento", address: "Rua A", description: "Teste",
      assignedTeamId: 9, statusRevision: 2,
    },
  }],
  total: 1,
});

describe("fail-closed field assignment response", () => {
  it("accepts only an internally consistent page for the authenticated team", () => {
    const page = fixture();
    expect(validateAssignmentResult(page, 9)).toBe(page);
    expect(validateAssignmentResult({ rows: [], total: 0 }, 9).rows).toEqual([]);
  });
  it("rejects absent or inconsistent team before enabling operations", () => {
    expect(() => validateAssignmentResult(fixture(), null)).toThrow();
    expect(() => validateAssignmentResult(fixture(), 8)).toThrowError(/escopo/);
    expect(() => validateAssignmentResult({
      rows: [{ ...fixture().rows[0], incident: { ...fixture().rows[0].incident, assignedTeamId: null } }],
      total: 1,
    }, 9)).toThrow();
  });
  it("rejects truncated, duplicate and malformed lists", () => {
    const item = fixture().rows[0];
    for (const value of [
      null, {}, { rows: null, total: 0 },
      { rows: [item], total: 0 },
      { rows: [item], total: Number.NaN },
      { rows: [item, item], total: 2 },
      { rows: Array.from({ length: 51 }, () => item), total: 51 },
      { rows: [null], total: 1 },
      { rows: [{ incident: { ...item.incident, status: "desconhecida" } }], total: 1 },
      { rows: [{ incident: { ...item.incident, statusRevision: -1 } }], total: 1 },
      { rows: [{ incident: { ...item.incident, priority: "urgentissima" } }], total: 1 },
    ]) expect(() => validateAssignmentResult(value, 9)).toThrow();
  });
  it("reports scope violations separately from corrupt data", () => {
    try { validateAssignmentResult(fixture(), 8); }
    catch (error) { expect(error).toMatchObject({ code: "TEAM_SCOPE_MISMATCH" }); }
    try { validateAssignmentResult({ rows: [], total: -1 }, 8); }
    catch (error) { expect(error).toMatchObject({ code: "INVALID_ASSIGNMENTS" }); }
  });
});
