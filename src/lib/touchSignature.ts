/**
 * Touch-signature geometry for the Android training document.
 * This is handwritten image capture, NOT a certified digital signature.
 * Every point remains in volatile memory; no I/O or server imports here.
 */
export type SignaturePoint = { x: number; y: number };
export type SignatureStroke = SignaturePoint[];
export const SIGNATURE_WIDTH = 600;
export const SIGNATURE_HEIGHT = 220;
export const MAX_SIGNATURE_STROKES = 40;
export const MAX_SIGNATURE_POINTS_PER_STROKE = 1200;

type Rectangle = { left: number; top: number; width: number; height: number };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function canvasSignaturePoint(
  clientX: number,
  clientY: number,
  rect: Rectangle,
): SignaturePoint {
  if (
    !Number.isFinite(clientX) || !Number.isFinite(clientY) ||
    !Number.isFinite(rect.left) || !Number.isFinite(rect.top) ||
    !Number.isFinite(rect.width) || !Number.isFinite(rect.height) ||
    rect.width <= 0 || rect.height <= 0
  ) throw new Error("Área de assinatura inválida.");
  return {
    x: Math.round(clamp(((clientX - rect.left) / rect.width) * SIGNATURE_WIDTH, 0, SIGNATURE_WIDTH) * 10) / 10,
    y: Math.round(clamp(((clientY - rect.top) / rect.height) * SIGNATURE_HEIGHT, 0, SIGNATURE_HEIGHT) * 10) / 10,
  };
}

export function appendSignaturePoint(
  stroke: SignatureStroke,
  point: SignaturePoint,
): SignatureStroke {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return stroke;
  if (stroke.length >= MAX_SIGNATURE_POINTS_PER_STROKE) return stroke;
  const last = stroke[stroke.length - 1];
  // Do not spend device memory recording stationary touch noise.
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < 1) return stroke;
  return [...stroke, point];
}

export function isMeaningfulSignature(strokes: readonly SignatureStroke[]): boolean {
  let totalPoints = 0;
  let travelled = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    totalPoints += stroke.length;
    for (let i = 0; i < stroke.length; i++) {
      const point = stroke[i];
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
      if (i) travelled += Math.hypot(point.x - stroke[i-1].x, point.y - stroke[i-1].y);
    }
  }
  return totalPoints >= 8 && travelled >= 70 && maxX - minX >= 40 && maxY - minY >= 8;
}
