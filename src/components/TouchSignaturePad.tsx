import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  appendSignaturePoint, canvasSignaturePoint, isMeaningfulSignature,
  MAX_SIGNATURE_STROKES, SIGNATURE_HEIGHT, SIGNATURE_WIDTH,
  type SignatureStroke,
} from "../lib/touchSignature";

type CapturedSignature = { pngDataUrl: string; capturedAt: number };
type Props = { code: string; onConfirm: (signature: CapturedSignature) => void };

function drawStroke(ctx: CanvasRenderingContext2D, stroke: SignatureStroke): void {
  if (!stroke.length) return;
  ctx.lineWidth = 2.7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#133c62";
  ctx.beginPath();
  ctx.moveTo(stroke[0].x, stroke[0].y);
  if (stroke.length === 1) ctx.lineTo(stroke[0].x + 0.01, stroke[0].y);
  for (const point of stroke.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();
}

export function TouchSignaturePad({ code, onConfirm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = useRef<{ pointerId: number; points: SignatureStroke } | null>(null);
  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [notice, setNotice] = useState("");

  function repaint(committed: readonly SignatureStroke[]) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
    for (const stroke of committed) drawStroke(ctx, stroke);
  }

  useEffect(() => { repaint(strokes); }, [strokes]);

  function down(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (active.current || strokes.length >= MAX_SIGNATURE_STROKES || !event.isPrimary) return;
    event.preventDefault();
    const point = canvasSignaturePoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    active.current = { pointerId: event.pointerId, points: [point] };
    event.currentTarget.setPointerCapture(event.pointerId);
    setNotice("");
    drawStroke(event.currentTarget.getContext("2d")!, [point]);
  }

  function move(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active.current || active.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    const point = canvasSignaturePoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    const before = active.current.points;
    const next = appendSignaturePoint(before, point);
    if (next === before) return;
    active.current.points = next;
    drawStroke(event.currentTarget.getContext("2d")!, next.slice(-2));
  }

  function up(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active.current || active.current.pointerId !== event.pointerId) return;
    move(event);
    const points = active.current.points;
    active.current = null;
    setStrokes(previous => previous.length < MAX_SIGNATURE_STROKES ? [...previous, points] : previous);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function cancel() {
    if (!active.current) return;
    active.current = null;
    repaint(strokes);
    setNotice("Traço interrompido; desenhe novamente.");
  }

  function clear() {
    active.current = null;
    setStrokes([]);
    setAcknowledged(false);
    setNotice("Área limpa. Nenhuma assinatura foi registrada.");
  }

  function confirm() {
    if (!acknowledged || !isMeaningfulSignature(strokes) || active.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // This PNG is a demonstration-only visual. No write, queue, storage or network.
    onConfirm({ pngDataUrl: canvas.toDataURL("image/png"), capturedAt: Date.now() });
  }

  return (
    <section className="touch-signature-document" aria-label="Documento de despacho demonstrativo">
      <div className="section-head">
        <div>
          <h3>Assinar relatório {code}</h3>
          <p className="hint">Assinatura manuscrita de laboratório — nenhum registro na central.</p>
        </div>
        <span className="pill">Somente demonstração</span>
      </div>
      <label className="touch-signature-label" htmlFor="touch-signature-canvas">
        Desenhe com o dedo ou caneta touch
      </label>
      <canvas
        ref={canvasRef}
        id="touch-signature-canvas"
        className="touch-signature-canvas"
        width={SIGNATURE_WIDTH}
        height={SIGNATURE_HEIGHT}
        aria-label="Área para desenhar a assinatura manuscrita"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
      />
      <p className="hint">A assinatura fica apenas na memória desta prévia, sem validade de certificado digital.</p>
      <label className="toggle">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={event => setAcknowledged(event.target.checked)}
        />
        Confirmo que este é apenas um documento fictício de demonstração.
      </label>
      <div className="button-grid">
        <button type="button" className="secondary" onClick={clear}>Limpar assinatura</button>
        <button type="button" className="primary" onClick={confirm}
          disabled={!acknowledged || !isMeaningfulSignature(strokes)}>
          Confirmar assinatura de teste
        </button>
      </div>
      {notice && <p className="hint" role="status">{notice}</p>}
    </section>
  );
}
