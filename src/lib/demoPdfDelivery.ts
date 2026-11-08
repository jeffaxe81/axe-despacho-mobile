import { Capacitor } from "@capacitor/core";
import type { DemoPdfResult } from "./demoSignaturePdf";

function base64Bytes(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
  }
  return btoa(parts.join(""));
}

/**
 * Distributes a synthetic PDF ONLY on an explicit user action.
 * Native Android uses a temporary cache file and the OS Share sheet.
 * The cache is cleared after the share action returns (best effort);
 * the recipient app may retain its own copy by user choice.
 */
export async function deliverDemoPdf(pdf: DemoPdfResult): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"), import("@capacitor/share"),
    ]);
    const path = `axe-demo-signature-${crypto.randomUUID()}.pdf`;
    await Filesystem.writeFile({
      path, directory: Directory.Cache, data: base64Bytes(pdf.bytes),
    });
    let deletionFailed = false;
    try {
      const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
      await Share.share({
        title: "AXE Despacho - relatorio de demonstracao",
        text: "DOCUMENTO FICTICIO - SEM VALIDADE JURIDICA",
        files: [uri],
        dialogTitle: "Compartilhar PDF demonstrativo",
      });
    } finally {
      try { await Filesystem.deleteFile({ path, directory: Directory.Cache }); }
      catch { deletionFailed = true; }
    }
    if (deletionFailed) throw new Error(
      "Nao foi possivel excluir o PDF temporario do cache; limpe os dados do aplicativo.",
    );
    return;
  }

  const blob = new Blob([Uint8Array.from(pdf.bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = pdf.filename;
  document.body.appendChild(link);
  try { link.click(); } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
