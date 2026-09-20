// ─── Utilitas render bentuk geometri (Shape Tools) & Gradient ────────────────

export interface ShapePoint {
  x: number;
  y: number;
}

/**
 * Menggambar garis lurus dari titik awal ke titik akhir.
 */
export function drawShapeLine(
  ctx: CanvasRenderingContext2D,
  from: ShapePoint,
  to: ShapePoint,
  size: number,
  color: string,
  opacity: number = 1,
): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.5, size);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Menggambar kotak / persegi panjang antara dua titik diagonal.
 */
export function drawShapeRect(
  ctx: CanvasRenderingContext2D,
  from: ShapePoint,
  to: ShapePoint,
  size: number,
  color: string,
  fill: boolean = false,
  opacity: number = 1,
): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.globalCompositeOperation = "source-over";

  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const w = Math.abs(to.x - from.x);
  const h = Math.abs(to.y - from.y);

  if (fill) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.5, size);
    ctx.lineJoin = "miter";
    ctx.strokeRect(x, y, w, h);
  }

  ctx.restore();
}

/**
 * Menggambar lingkaran / elips di dalam bounding box antara dua titik diagonal.
 */
export function drawShapeEllipse(
  ctx: CanvasRenderingContext2D,
  from: ShapePoint,
  to: ShapePoint,
  size: number,
  color: string,
  fill: boolean = false,
  opacity: number = 1,
): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.globalCompositeOperation = "source-over";

  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const w = Math.abs(to.x - from.x);
  const h = Math.abs(to.y - from.y);

  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = Math.max(0.1, w / 2);
  const ry = Math.max(0.1, h / 2);

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);

  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.5, size);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Menerapkan gradient linear atau radial dari titik tarik ke seluruh kanvas layer.
 */
export function drawShapeGradient(
  ctx: CanvasRenderingContext2D,
  from: ShapePoint,
  to: ShapePoint,
  width: number,
  height: number,
  color: string,
  isRadial: boolean = false,
  opacity: number = 1,
): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.globalCompositeOperation = "source-over";

  let grad: CanvasGradient;

  if (isRadial) {
    const radius = Math.hypot(to.x - from.x, to.y - from.y);
    grad = ctx.createRadialGradient(from.x, from.y, 0, from.x, from.y, Math.max(1, radius));
    grad.addColorStop(0, color);
    grad.addColorStop(1, "rgba(0,0,0,0)");
  } else {
    grad = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "rgba(0,0,0,0)");
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
