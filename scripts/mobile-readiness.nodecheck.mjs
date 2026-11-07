import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateMobileReadiness, formatMobileReadinessSummary, MOBILE_REAL_GATES } from './mobile-readiness.mjs';

const source = new URL('../docs/quality/mobile-release-gates.json', import.meta.url);
const fixture = () => JSON.parse(readFileSync(source, 'utf8'));
const now = new Date('2026-11-07T18:00:00.000Z');
function completed() {
  const m = fixture();
  for (const gate of m.external_environment_tests) {
    gate.status = 'PASSED_REAL_ENVIRONMENT';
    gate.owner = 'homologation-team';
    gate.executed_at = '2026-11-07T12:00:00Z';
    gate.evidence_url = 'https://github.com/jeffaxe81/axe-despacho-mobile/issues/4';
  }
  return m;
}
test('current mobile release: 0% real, NO_GO, no production approval', () => {
  assert.deepEqual(MOBILE_REAL_GATES, ['ANDROID-AUTH','ANDROID-GPS','ANDROID-E2E','IOS-RELEASE']);
  assert.deepEqual(
    { ...evaluateMobileReadiness(fixture(), now), findings: [] },
    { decision: 'NO_GO', production_approved: false, ci_not_assessed: true,
      manifest_valid: true, required_gates: 4, evidenced_gates: 0,
      real_environment_progress_percent: 0, pending_gate_ids: MOBILE_REAL_GATES, findings: [] }
  );
});
test('measures 25/50/75/100 and still requires manual release review', () => {
  const m = completed();
  assert.equal(evaluateMobileReadiness(m, now).real_environment_progress_percent, 100);
  assert.equal(evaluateMobileReadiness(m, now).decision, 'MANUAL_GO_REVIEW_REQUIRED');
  assert.equal(evaluateMobileReadiness(m, now).production_approved, false);
  for (let n = 1; n <= 4; n++) {
    const part = structuredClone(m);
    for (let i = n; i < 4; i++) part.external_environment_tests[i].status = 'PENDING_REAL_ENVIRONMENT';
    assert.equal(evaluateMobileReadiness(part, now).real_environment_progress_percent, n * 25);
    if (n < 4) assert.equal(evaluateMobileReadiness(part, now).decision, 'NO_GO');
  }
});
test('cannot count missing, expired or unsafe evidence as completed', () => {
  const m = completed();
  m.external_environment_tests[0].owner = 'to_be_assigned';
  m.external_environment_tests[1].executed_at = '2030-01-01T00:00:00Z';
  m.external_environment_tests[2].evidence_url = 'http://example.test/report';
  assert.equal(evaluateMobileReadiness(m, now).real_environment_progress_percent, 25);
  assert.equal(evaluateMobileReadiness(m, now).production_approved, false);
});
test('rejects tampered policy, duplicate/unknown/missing gates without fake percentage', () => {
  const m = completed();
  m.policy.do_not_enable_native_login_or_gps_without_homologation = false;
  assert.equal(evaluateMobileReadiness(m, now).real_environment_progress_percent, 0);
  assert.equal(evaluateMobileReadiness(m, now).manifest_valid, false);
  const dupe = completed();
  dupe.external_environment_tests.push({ ...dupe.external_environment_tests[0] });
  assert.equal(evaluateMobileReadiness(dupe, now).real_environment_progress_percent, 0);
  assert.equal(evaluateMobileReadiness(dupe, now).manifest_valid, false);
  const unknown = completed();
  unknown.external_environment_tests[0].id = 'UNKNOWN';
  assert.equal(evaluateMobileReadiness(unknown, now).manifest_valid, false);
});
test('never echoes credentials or private evidence into GitHub summary', () => {
  const m = completed();
  m.external_environment_tests[0].secret = 'DO_NOT_PRINT_TOKEN';
  const report = evaluateMobileReadiness(m, now);
  const rendered = formatMobileReadinessSummary(report);
  assert.match(rendered, /100%/);
  assert.match(rendered, /Produção autorizada: \*\*NÃO\*\*/);
  assert.doesNotMatch(JSON.stringify(report) + rendered, /DO_NOT_PRINT_TOKEN|github.com|homologation-team/);
});
