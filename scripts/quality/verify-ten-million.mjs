import { readFileSync, readdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const groups=[
  "rbac","incident_contract","team_snapshot","session_epoch","freshness",
  "lifecycle","gps_integrity","gps_antireplay","offline_privacy","logout_security"
];
const root="artifacts/ten-million";
let total=0;
const results=[];
const files=readdirSync(root).filter(f=>f.endsWith(".json")).sort();
if(files.length!==groups.length)throw new Error("Expected exactly 10 receipts, got "+files.length);
for(const [index,group] of groups.entries()){
  const filename="receipt-"+group+".json";
  if(!files.includes(filename))throw new Error("Missing shard receipt: "+group);
  const data=JSON.parse(readFileSync(join(root,filename),"utf8"));
  const expectedSeed=(0x87e02026 ^ Math.imul(index+1,0x9e3779b9))>>>0;
  if(data.schema_version!==1 || data.group!==group || data.seed!==expectedSeed ||
     data.evaluations!==1_000_000 || data.failures!==0 ||
     data.evidence_type!=="synthetic_policy_checks" ||
     data.real_environment_homologation!==false || data.production_approved!==false ||
     !/^[0-9a-f]{8}$/.test(data.fingerprint)){
    throw new Error("Malformed, mismatched or incomplete receipt "+group);
  }
  total+=data.evaluations;
  results.push({group,checks:data.evaluations,seed:data.seed,fingerprint:data.fingerprint});
}
if(total!==10_000_000)throw new Error("Incomplete execution: "+total);
const message={
  status:"PASSED_SYNTHETIC_ONLY",
  scenario_evaluations:total,
  vitest_test_items:10,
  shard_receipts:results,
  production_approved:false,
  real_environment_homologation:false
};
process.stdout.write("MOBILE_10M_AGGREGATE_PASS "+JSON.stringify(message)+"\n");
if(process.env.GITHUB_STEP_SUMMARY){
  const summary=[
    "## AXE Despacho Mobile — 10 milhões de verificações sintéticas",
    "",
    "**10.000.000/10.000.000 avaliações de cenários verificadas** (10 shards × 1.000.000).",
    "",
    "| Área | Avaliações | Seed | Fingerprint |",
    "| --- | ---: | --- | --- |",
    ...results.map(r=>"| "+r.group+" | "+r.checks.toLocaleString("pt-BR")+" | "+r.seed+" | "+r.fingerprint+" |"),
    "",
    "- Dez testes Vitest de longa execução, cada um avaliando um milhão de entradas.",
    "- Repetições podem ocorrer nos valores gerados; **não** equivale a 10 milhões de casos únicos nem a 10 milhões de testes E2E.",
    "- Nenhum aparelho, API operacional, GPS físico, usuário real ou ambiente de homologação foi exercitado.",
    "- Gates reais Android/iOS inalterados. **Produção NÃO autorizada.**",
    ""
  ].join("\n");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary,"utf8");
}
