import { readFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const MOBILE_REAL_GATES = ['ANDROID-AUTH', 'ANDROID-GPS', 'ANDROID-E2E', 'IOS-RELEASE'];
const ALLOWED = new Set(['PENDING_REAL_ENVIRONMENT', 'PASSED_REAL_ENVIRONMENT', 'FAILED_REAL_ENVIRONMENT']);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function timestampOK(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() <= now.getTime() &&
    date.toISOString() === (value.includes('.') ? value : value.replace('Z', '.000Z'));
}
function evidenceUrlOK(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

/** Report-only: no network, credentials, OAuth, GPS, migrations or production access. */
export function evaluateMobileReadiness(manifest, now = new Date()) {
  const findings = [];
  const pending = [];
  const rows = new Map();
  let evidenced = 0;
  if (!record(manifest) || manifest.schema_version !== 1 ||
      manifest.project !== 'AXE Despacho Mobile' ||
      manifest.release_status !== 'NOT_APPROVED_FOR_PRODUCTION') {
    findings.push('INVALID_RELEASE_MANIFEST');
  }
  const policy = record(manifest?.policy) ? manifest.policy : {};
  if (policy.manual_environment_tests_required_before_production_go !== true ||
      policy.do_not_claim_unperformed_tests_as_passed !== true ||
      policy.do_not_enable_native_login_or_gps_without_homologation !== true) {
    findings.push('POLICY_UNSAFE');
  }
  if (!Array.isArray(manifest?.external_environment_tests)) findings.push('REQUIRED_GATES_UNAVAILABLE');
  for (const row of Array.isArray(manifest?.external_environment_tests) ? manifest.external_environment_tests : []) {
    if (!record(row) || !MOBILE_REAL_GATES.includes(row.id)) {
      findings.push('UNKNOWN_GATE');
    } else if (rows.has(row.id)) {
      findings.push('DUPLICATE_GATE');
    } else rows.set(row.id, row);
  }
  for (const id of MOBILE_REAL_GATES) {
    const row = rows.get(id);
    if (!row) { findings.push('MISSING_GATE'); pending.push(id); continue; }
    if (!ALLOWED.has(row.status)) { findings.push('INVALID_GATE'); pending.push(id); continue; }
    if (row.status !== 'PASSED_REAL_ENVIRONMENT') {
      pending.push(id);
      if (row.status === 'FAILED_REAL_ENVIRONMENT') findings.push('FAILED_REAL_TEST');
      continue;
    }
    if (typeof row.owner !== 'string' || !row.owner.trim() || row.owner === 'to_be_assigned' ||
        !timestampOK(row.executed_at, now) || !evidenceUrlOK(row.evidence_url)) {
      pending.push(id);
      findings.push('INCOMPLETE_EVIDENCE');
    } else evidenced++;
  }
  const structureErrors = new Set(['INVALID_RELEASE_MANIFEST','POLICY_UNSAFE','REQUIRED_GATES_UNAVAILABLE',
    'UNKNOWN_GATE','DUPLICATE_GATE','MISSING_GATE','INVALID_GATE']);
  const manifestValid = !findings.some(f => structureErrors.has(f));
  const verified = manifestValid ? evidenced : 0;
  return {
    decision: manifestValid && pending.length === 0 ? 'MANUAL_GO_REVIEW_REQUIRED' : 'NO_GO',
    production_approved: false,
    ci_not_assessed: true,
    manifest_valid: manifestValid,
    required_gates: MOBILE_REAL_GATES.length,
    evidenced_gates: verified,
    real_environment_progress_percent: Math.floor(verified * 100 / MOBILE_REAL_GATES.length),
    pending_gate_ids: pending,
    findings: [...new Set(findings)],
  };
}
export function formatMobileReadinessSummary(result) {
  return [
    '### AXE Despacho Mobile — homologação operacional',
    '',
    '**Homologação real: ' + result.real_environment_progress_percent + '% (' +
      result.evidenced_gates + '/' + result.required_gates + ' gates)**',
    '',
    '| Gate | Situação |',
    '| --- | --- |',
    ...MOBILE_REAL_GATES.map(id => '| ' + id + ' | ' +
      (result.pending_gate_ids.includes(id) ? 'Pendente' : 'Evidência registrada para revisão') + ' |'),
    '',
    '- Decisão automática: ' + result.decision,
    '- Produção autorizada: **NÃO**',
    '- A aprovação de CI é avaliada separadamente.',
    '',
  ].join('\n');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const manifest = JSON.parse(readFileSync(new URL('../docs/quality/mobile-release-gates.json', import.meta.url), 'utf8'));
    const result = evaluateMobileReadiness(manifest);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, formatMobileReadinessSummary(result) + '\n', 'utf8');
    }
    if (!result.manifest_valid) process.exitCode = 2;
  } catch {
    process.stderr.write('MOBILE_READINESS_MANIFEST_UNREADABLE\n');
    process.exitCode = 2;
  }
}
