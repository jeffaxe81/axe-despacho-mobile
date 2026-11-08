import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { DemoIncident } from "./fieldDemo";

export type DemoSignatureInput = {
  incident: DemoIncident;
  pngDataUrl: string;
  capturedAt: number;
};
export type DemoPdfResult = {
  bytes: Uint8Array;
  filename: string;
  pdfSha256: string;
  sourceSha256: string;
};

const MAX_PNG_DATA_URL_LENGTH = 3_000_000;
const DEMO_CODE = /^DEMO-[A-Z0-9-]{1,24}$/;

function ascii(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?").replace(/\s+/g, " ").trim();
}

function cut(text: string, length: number): string {
  const clean = ascii(text);
  return clean.length <= length ? clean : clean.slice(0, length - 3) + "...";
}

function wrap(text: string, maxCharacters: number, maxLines: number): string[] {
  const words = ascii(text).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!word) continue;
    const parts = word.match(new RegExp(`.{1,${maxCharacters}}`, "g")) ?? [];
    for (const part of parts) {
      const next = line ? line + " " + part : part;
      if (next.length > maxCharacters && line) {
        lines.push(line);
        line = part;
      } else line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  return [...lines.slice(0, maxLines - 1), cut(lines.slice(maxLines - 1).join(" "), maxCharacters)];
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Works in secure Android WebView and regular secure browser contexts.
  if (!globalThis.crypto?.subtle) throw new Error("SHA-256 nao disponivel neste dispositivo.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

function decodeSignaturePng(dataUrl: string): Uint8Array {
  if (dataUrl.length > MAX_PNG_DATA_URL_LENGTH ||
    !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)) {
    throw new Error("Imagem de assinatura demonstrativa invalida.");
  }
  const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), value => value.charCodeAt(0));
  if (bytes.length < 60 ||
      ![137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)) {
    throw new Error("Arquivo de assinatura nao e PNG valido.");
  }
  return bytes;
}

export function assertDemoSignatureInput(input: DemoSignatureInput): void {
  const incident = input.incident;
  if (!Number.isSafeInteger(incident.id) || incident.id < 90_000 ||
      !DEMO_CODE.test(incident.code) || incident.status !== "concluida" ||
      incident.category.length > 200 || incident.description.length > 2000 ||
      incident.address.length > 300) {
    throw new Error("Somente ocorrencias ficticias concluidas podem gerar PDF.");
  }
  if (!Number.isFinite(input.capturedAt) || input.capturedAt <= 0 ||
      input.capturedAt > Date.now() + 60_000) {
    throw new Error("Horario da assinatura demonstrativa invalido.");
  }
  decodeSignaturePng(input.pngDataUrl);
}

/**
 * Creates a demonstrative PDF with a VISUAL handwritten mark, not a digital
 * certificate or legally verified signature. Never calls an external API.
 * The hash of the final PDF is returned separately (cannot embed itself).
 */
export async function createDemoDispatchPdf(input: DemoSignatureInput): Promise<DemoPdfResult> {
  assertDemoSignatureInput(input);
  const { incident, capturedAt } = input;
  const png = decodeSignaturePng(input.pngDataUrl);
  const imageSha256 = await sha256Hex(png);
  const capturedAtIso = new Date(capturedAt).toISOString();
  const sourceSha256 = await sha256Hex(
    new TextEncoder().encode(JSON.stringify({
      schema: "axe-demo-dispatch-signature-v1",
      incidentId: incident.id,
      code: incident.code,
      category: incident.category,
      status: incident.status,
      priority: incident.priority,
      address: incident.address,
      description: incident.description,
      capturedAt: capturedAtIso,
      imageSha256,
    })),
  );

  const pdf = await PDFDocument.create();
  pdf.setTitle(`AXE Despacho - demonstracao ${incident.code}`);
  pdf.setSubject("DEMONSTRACAO SEM VALIDADE JURIDICA - imagem manuscrita");
  pdf.setAuthor("AXE Despacho Mobile - laboratorio");
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.07,0.20,0.32);
  const dim = rgb(0.34,0.43,0.50);
  const red = rgb(0.72,0.13,0.14);
  const left = 48;
  const write = (text: string, x: number, y: number, size = 11, weight = font, color = navy) =>
    page.drawText(cut(text, 110), { x, y, size, font: weight, color });

  page.drawRectangle({ x:0, y:790, width:595.28, height:52, color:navy });
  write("AXE DESPACHO  |  RELATORIO DEMONSTRATIVO", left, 809, 15, bold, rgb(1,1,1));
  write("DEMONSTRACAO - SEM VALIDADE JURIDICA", left, 765, 14, bold, red);
  page.drawLine({start:{x:left,y:748},end:{x:547,y:748},thickness:1,color:rgb(.75,.82,.86)});
  write("Ocorrencia: " + incident.code, left, 718, 12, bold);
  write("Identificador ficticio: " + incident.id, left, 697);
  write("Categoria: " + cut(incident.category, 70), left, 676);
  write("Situacao: CONCLUIDA (somente demonstracao)", left, 655);
  write("Prioridade: " + cut(incident.priority, 48), left, 634);
  write("Local ficticio: " + cut(incident.address, 78), left, 613);
  write("Descricao da ocorrencia", left, 581, 12, bold);
  let y = 562;
  for (const line of wrap(incident.description, 82, 5)) {
    write(line, left, y, 10);
    y -= 17;
  }
  write("Assinatura manuscrita ilustrativa", left, 454, 12, bold);
  const image = await pdf.embedPng(png);
  const dims = image.scaleToFit(360, 115);
  page.drawRectangle({x:left,y:310,width:390,height:133,borderWidth:1,borderColor:rgb(.68,.78,.82),color:rgb(1,1,1)});
  page.drawImage(image,{x:left+12,y:319+(115-dims.height)/2,width:dims.width,height:dims.height});
  write("Registro visual confirmado: " + capturedAtIso, left, 284, 10);
  write("SHA-256 dos dados de origem (inclui a imagem):", left, 251, 10, bold);
  write(sourceSha256, left, 234, 9);
  page.drawLine({start:{x:left,y:200},end:{x:547,y:200},thickness:1,color:rgb(.75,.82,.86)});
  write("Esta imagem NAO comprova identidade ou assinatura digital certificada.", left, 174, 10, bold, red);
  write("Sem autenticacao operacional, sem envio ao servidor e sem carimbo de tempo.", left, 157, 9, font, dim);
  write("Nao utilizar este documento ficticio para atendimento, processo ou prova.", left, 140, 9, font, dim);
  write("Documento local de laboratorio. O SHA-256 do PDF e calculado fora deste arquivo.", left, 98, 9, font, dim);
  write("AXE Despacho Mobile - Simulador Android", left, 65, 9, font, dim);
  const bytes = Uint8Array.from(await pdf.save());
  return {
    bytes,
    filename:`axe-despacho-${incident.code}-demonstracao.pdf`,
    pdfSha256: await sha256Hex(bytes),
    sourceSha256,
  };
}
