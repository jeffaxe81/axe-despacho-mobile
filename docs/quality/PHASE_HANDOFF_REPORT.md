# AXE Despacho Mobile — evidências de passagem por fase

Baseline verificada em **07/11/2026**, commit `ebfb8c4c71c45015401a1a2c2a6c0f07d8afefff`. Este inventário é **somente de desenvolvimento**: não declara que o sistema como um todo esteja 50% concluído, nem aprova produção.

| Fase | Critério para passagem | Evidência atual | Cobertura documental |
| --- | --- | --- | --- |
| F01 — Escopo e arquitetura | Escopo e limitações registrados | [Documento de referência](https://github.com/jeffaxe81/axe-despacho-mobile/blob/ebfb8c4c71c45015401a1a2c2a6c0f07d8afefff/docs/ROADMAP.md) | 100% |
| F02 — Implementação versionada | Alteração revisável e integrada à main | [PR #21](https://github.com/jeffaxe81/axe-despacho-mobile/pull/21) | 100% |
| F03 — QA e build | CI no SHA de referência com conclusão success | [GitHub Actions #42394805985](https://github.com/jeffaxe81/axe-despacho-mobile/actions/runs/42394805985) · [GitHub Actions #42394805960](https://github.com/jeffaxe81/axe-despacho-mobile/actions/runs/42394805960) | 100% |
| F04 — Revisão independente de segurança | Parecer técnico registrado com autor, achados e aceite | [Pendência de segurança](https://github.com/jeffaxe81/axe-despacho-mobile/issues/4) | 0% |
| F05 — Homologação real | Evidências de todas as validações reais, não apenas CI | [Pendências de homologação](https://github.com/jeffaxe81/axe-despacho-mobile/issues/5) · **0/4 comprovados** | 0% |
| F06 — Release e distribuição | Aprovação GO documentada, rollout, rollback e responsável | Não autorizada | 0% |

**Indicador:** 3/6 fases com evidências de desenvolvimento registradas = **50% de cobertura documental**. Isto mede o **registro da evidência por fase**, não o percentual total de funcionalidades, a eficácia de segurança ou a aprovação da passagem formal.

**Regra de passagem:** fase anterior documentada, código rastreável ao SHA, testes verdes no mesmo contexto de integração e revisão do responsável. Para F04–F06 devem existir provas adicionais, não inferidas de testes simulados. Assinatura/aceite humano explícito é obrigatório antes da passagem formal. Estados pendentes permanecem em 0% até que sejam cumpridos.

**Automação:** `node scripts/quality/phase-handoff-audit.mjs` lê `docs/quality/phase-handoff-evidence.json`, rejeita referências inválidas, fases fora de ordem e tentativas de marcar produção como aprovada. `node --test scripts/quality/phase-handoff-audit.nodecheck.mjs` cobre as negativas. Os URLs são verificados apenas sintaticamente — sua autenticidade e aprovação são revisadas por pessoa responsável.

**Separação obrigatória:** a homologação real permanece controlada pelo respectivo manifesto operacional (4 gates Android/iOS). O comando de fases não libera login, GPS operacional, migração, integração externa, instalação ou produção.
