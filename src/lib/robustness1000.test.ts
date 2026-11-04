import { describe, expect, it } from "vitest";
import { validateAssignmentResult } from "./assignmentValidation";
import { statuses, isFieldUser } from "./contracts";
import { isFieldSnapshotFresh, FIELD_SNAPSHOT_MAX_AGE_MS } from "./clientFreshness";
import { shouldAttemptFreshLocation } from "../hooks/useFieldLocation";

/**
 * Exactly 1,000 deterministic, independently named scenarios.
 *
 * Each case invokes a real production helper and compares against a separate
 * policy oracle: 250 DTO/tenant cases + 250 agent authorization cases +
 * 250 clock/refresh cases + 250 GPS anti-replay/rate-limit cases.
 * These are pure unit/policy tests, not 1,000 device, backend or E2E tests.
 * No credentials, live API, GPS hardware or production state are accessed.
 */
const invalidStatuses = ["nao_existe", "REVOKED"];
const allStatuses = [...statuses, ...invalidStatuses];
const allPriorities = ["baixa", "media", "alta", "critica", "urgentissima"];
const ownershipModes = ["matching", "other-team", "missing-team", "duplicate-id", "unassigned"] as const;
const assignmentCases = allStatuses.flatMap((status, si) =>
  allPriorities.flatMap((priority, pi) =>
    ownershipModes.map((mode, mi) => ({
      label: `assignment/${si}-${pi}-${mi}`, status, priority, mode,
    }))
  )
);
if (assignmentCases.length !== 250) throw new Error("Expected 250 assignment scenarios");

describe("AXE Despacho: 250 real contract/tenant guards", () => {
  it.each(assignmentCases)("$label", ({ status, priority, mode }) => {
    const incident: Record<string, unknown> = {
      id: 1201, code: "OCO-1201", status, priority,
      category: "Resgate", address: "Local de teste", description: "Somente fixture",
      assignedTeamId: 7, statusRevision: 4,
    };
    if (mode === "other-team") incident.assignedTeamId = 8;
    if (mode === "missing-team") delete incident.assignedTeamId;
    if (mode === "unassigned") incident.assignedTeamId = null;
    const rows = [{ incident }];
    if (mode === "duplicate-id") rows.push({ incident: { ...incident } });
    const page = { rows, total: rows.length };
    const expectedAccept =
      statuses.includes(status as (typeof statuses)[number]) &&
      allPriorities.slice(0, 4).includes(priority) && mode === "matching";
    if (expectedAccept) {
      expect(validateAssignmentResult(page, 7)).toBe(page);
    } else {
      expect(() => validateAssignmentResult(page, 7)).toThrow();
    }
  });
});

const roles = ["agente", "despachador", "coordenador", "administrador", "supervisor"];
const permissionSets = [
  ["occurrences.view", "occurrences.transition"],
  ["occurrences.view"],
  ["occurrences.transition"],
  [],
  ["occurrences.close", "occurrences.view", "occurrences.transition"],
];
const teamIds: Array<number | null> = [1, 2, 0, -1, null];
const organizationIds = [1, 0];
const accessCases = roles.flatMap((role, ri) =>
  permissionSets.flatMap((permissions, pi) =>
    teamIds.flatMap((teamId, ti) =>
      organizationIds.map((orgId, oi) => ({
        label: `access/${ri}-${pi}-${ti}-${oi}`, role, permissions, teamId, orgId,
      }))
    )
  )
);
if (accessCases.length !== 250) throw new Error("Expected 250 access scenarios");

describe("AXE Despacho: 250 role, team and organization gates", () => {
  it.each(accessCases)("$label", ({ role, permissions, teamId, orgId }) => {
    const user = { id: 41, name: "Agente", operationalRole: role, teamId, active: true };
    const allowed = role === "agente" && (teamId === 1 || teamId === 2) &&
      orgId === 1 && permissions.includes("occurrences.view") &&
      permissions.includes("occurrences.transition");
    expect(isFieldUser(user, { permissions }, orgId)).toBe(allowed);
  });
});

const baselines = [0, 1, 44_999, 45_000, 45_001, 90_000, 1_000_000, 14_000_000, 1_700_000_000_000, 2_000_000_000_000];
const ageOffsets = [
  -46_000, -45_000, -1_000, -2, -1, 0, 1, 2, 500, 1_000,
  4_999, 5_000, 9_999, 10_000, 19_999, 20_000, 29_999,
  30_000, 44_999, 45_000, 45_001, 46_000, 60_000, 120_000, 900_000,
];
const freshnessCases = baselines.flatMap((base, bi) =>
  ageOffsets.map((age, ai) => ({ label: `freshness/${bi}-${ai}`, base, age }))
);
if (freshnessCases.length !== 250) throw new Error("Expected 250 freshness scenarios");

describe("AXE Despacho: 250 deterministic freshness boundaries", () => {
  it.each(freshnessCases)("$label", ({ base, age }) => {
    const now = base + age;
    const allowed = base >= 0 && now >= base && age <= FIELD_SNAPSHOT_MAX_AGE_MS;
    expect(isFieldSnapshotFresh(base, now)).toBe(allowed);
  });
});

const attemptDelay: Array<number | null> = [
  null, -20_000, -1, 0, 1, 100, 500, 999, 1_000,
  5_000, 10_000, 15_000, 19_998, 19_999, 20_000,
  20_001, 21_000, 25_000, 30_000, 60_000, 120_000,
  3_600_000, 42, 19_950, 45_000,
];
const gpsExamples = [
  { age: 0, accuracy: 10, lat: -27.0, long: -48.0, valid: true },
  { age: 1, accuracy: 500, lat: 0, long: 0, valid: true },
  { age: 9_999, accuracy: 20, lat: 90, long: -180, valid: true },
  { age: 10_000, accuracy: 15, lat: 15, long: 30, valid: false }, // same sample
  { age: 10_001, accuracy: 15, lat: 15, long: 30, valid: false }, // older sample
  { age: 30_000, accuracy: 15, lat: 15, long: 30, valid: false },
  { age: 30_001, accuracy: 15, lat: 15, long: 30, valid: false },
  { age: -1, accuracy: 15, lat: 15, long: 30, valid: false },
  { age: 5_000, accuracy: 501, lat: 15, long: 30, valid: false },
  { age: 5, accuracy: 20, lat: 91, long: 30, valid: false },
];
const gpsCases = attemptDelay.flatMap((delay, di) =>
  gpsExamples.map((example, ei) => ({
    label: `gps/${di}-${ei}`, delay, example,
  }))
);
if (gpsCases.length !== 250) throw new Error("Expected 250 GPS scenarios");

describe("AXE Despacho: 250 GPS deduplication, time and rate-limit guards", () => {
  it.each(gpsCases)("$label", ({ delay, example }) => {
    const now = 1_000_000;
    const sample = {
      latitude: example.lat,
      longitude: example.long,
      accuracy: example.accuracy,
      timestamp: now - example.age,
    };
    const lastAttemptAt = delay === null ? null : now - delay;
    const lastAttemptFixAt = now - 10_000;
    // The modeled clock is 1,000,000ms after epoch; a prior attempt cannot
    // have a negative timestamp even if its elapsed interval exceeds 20s.
    const eligible = example.valid && (delay === null ||
      (delay >= 20_000 && now - delay >= 0));
    expect(shouldAttemptFreshLocation(lastAttemptAt, lastAttemptFixAt, sample, now)).toBe(eligible);
  });
});
