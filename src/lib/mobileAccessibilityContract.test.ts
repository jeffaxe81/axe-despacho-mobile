import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

/** Structural regression. This does not claim actual screen-reader or WCAG
 * certification; human accessibility testing remains a real-environment gate.
 */
describe("Mobile field accessible controls and status",()=>{
  const app=readFileSync("src/App.tsx","utf8");
  const css=readFileSync("src/styles.css","utf8");

  it("provides a skip link and focusable main content target",()=>{
    expect(app).toContain('href="#main-content"');
    expect(app).toContain('id="main-content" tabIndex={-1}');
    expect(css).toContain(".skip-link:focus-visible");
  });

  it("exposes selected incident state and a non-sensitive spoken label",()=>{
    expect(app).toContain("aria-pressed={selected?.incident.id===incident.id}");
    expect(app).toContain("Abrir ocorrência ${incident.code}");
    expect(app).toContain("prioridade ${incident.priority}");
    expect(app).not.toContain("aria-label={incident.description}");
  });

  it("announces online state and operational restrictions",()=>{
    expect(app).toContain('role="status" aria-live="polite"');
    expect(app).toContain('aria-atomic="true"');
    expect(app).toContain("operationState.message");
    expect(css).toContain(".operational-banner.blocked");
  });

  it("respects reduced motion and keyboard visibility",()=>{
    expect(css).toContain("@media(prefers-reduced-motion:reduce)");
    expect(css).toContain(":focus-visible");
    expect(css).toContain(".incident-card{min-height:44px}");
  });
});
