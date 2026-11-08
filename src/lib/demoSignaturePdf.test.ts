import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { assertDemoSignatureInput, createDemoDispatchPdf, type DemoSignatureInput } from "./demoSignaturePdf";

const testInput: DemoSignatureInput = {
  incident: {
    id:90003,code:"DEMO-003",status:"concluida",priority:"baixa",
    category:"Registro de exemplo",address:"Local ficticio, sem localizacao real",
    description:"Registro de teste da ocorrencia DEMO-003",assignedTeamId:900,
  },
  capturedAt:1731000000000,
  pngDataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAALklEQVR4nGP8////fwY0wIQuwMDAwMAoZxP1n4GBgeHh4aUIQZh2edtoTEFkAAB3DRCuuIa3dwAAAABJRU5ErkJggg==",
};

describe("PDF demonstrativo de despacho com marca visual", () => {
  it("recusa ocorrencia real e ocorrencia nao concluida", () => {
    expect(() => assertDemoSignatureInput({...testInput, incident:{...testInput.incident,code:"OCO-123"}})).toThrow();
    expect(() => assertDemoSignatureInput({...testInput, incident:{...testInput.incident,status:"em_atendimento"}})).toThrow();
    expect(() => assertDemoSignatureInput({...testInput, incident:{...testInput.incident,id:5}})).toThrow();
  });
  it("recusa imagem vazia ou formato arbitrario", () => {
    expect(() => assertDemoSignatureInput({...testInput,pngDataUrl:"data:image/svg+xml;base64,AAAA"})).toThrow();
    expect(() => assertDemoSignatureInput({...testInput,pngDataUrl:""})).toThrow();
  });
  it("recusa horario invalido ou no futuro", () => {
    expect(() => assertDemoSignatureInput({...testInput,capturedAt:Date.now()+600_000})).toThrow();
    expect(() => assertDemoSignatureInput({...testInput,capturedAt:NaN})).toThrow();
  });
  it("gera PDF com uma pagina e SHA-256 dos bytes finais", async () => {
    const report = await createDemoDispatchPdf(testInput);
    expect(report.filename).toBe("axe-despacho-DEMO-003-demonstracao.pdf");
    expect(report.bytes[0]).toBe(37); // %PDF
    expect(report.bytes.length).toBeGreaterThan(1100);
    expect(report.pdfSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    const expected = new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(report.bytes)));
    expect(report.pdfSha256).toBe(Array.from(expected,b=>b.toString(16).padStart(2,"0")).join(""));
    const parsed=await PDFDocument.load(report.bytes);
    expect(parsed.getPageCount()).toBe(1);
    expect(parsed.getTitle()).toContain("DEMO-003");
    expect(parsed.getSubject()).toContain("SEM VALIDADE JURIDICA");
  });
});
