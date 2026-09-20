import { hslStringToRgb } from "./canvasUtils";

export type BrushPoint = { x: number; y: number; pressure: number };

// ── Helper internal ────────────────────────────────────────────────────────────

/** Interpolasi linear antara dua nilai */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Hitung jarak antara dua titik */
function dist(a: BrushPoint, b: BrushPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// In-memory cache agar tidak mem-parsing string warna yang sama berulang kali di setiap goresan
const COLOR_CACHE = new Map<string, [number, number, number]>();
let sharedColorCanvas: HTMLCanvasElement | null = null;
let sharedColorCtx: CanvasRenderingContext2D | null = null;

/**
 * Parse warna CSS menjadi komponen r, g, b (0–255).
 * Sangat dioptimalkan: cek cache -> cek format HSL langsung -> fallback canvas tunggal.
 */
function parseColor(css: string): [number, number, number] {
  const cached = COLOR_CACHE.get(css);
  if (cached) return cached;

  let parsed: [number, number, number];

  // Draw App utamanya menggunakan format hsl(...)
  if (css.startsWith("hsl")) {
    parsed = hslStringToRgb(css);
  } else if (css.startsWith("#")) {
    // Hex format (#RGB / #RRGGBB)
    const hex = css.slice(1);
    if (hex.length === 3) {
      parsed = [
        parseInt(hex[0] + hex[0], 16) || 0,
        parseInt(hex[1] + hex[1], 16) || 0,
        parseInt(hex[2] + hex[2], 16) || 0,
      ];
    } else {
      parsed = [
        parseInt(hex.slice(0, 2), 16) || 0,
        parseInt(hex.slice(2, 4), 16) || 0,
        parseInt(hex.slice(4, 6), 16) || 0,
      ];
    }
  } else if (css.startsWith("rgb")) {
    const match = css.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
    parsed = match
      ? [Math.round(Number(match[1])), Math.round(Number(match[2])), Math.round(Number(match[3]))]
      : [0, 0, 0];
  } else {
    // Fallback: gunakan 1 shared canvas singleton alih-alih createElement di setiap frame
    if (!sharedColorCanvas) {
      sharedColorCanvas = document.createElement("canvas");
      sharedColorCanvas.width = 1;
      sharedColorCanvas.height = 1;
      sharedColorCtx = sharedColorCanvas.getContext("2d", { willReadFrequently: true });
    }
    if (sharedColorCtx) {
      sharedColorCtx.fillStyle = css;
      sharedColorCtx.fillRect(0, 0, 1, 1);
      const d = sharedColorCtx.getImageData(0, 0, 1, 1).data;
      parsed = [d[0], d[1], d[2]];
    } else {
      parsed = [0, 0, 0];
    }
  }

  // Batasi ukuran cache agar tidak membengkak
  if (COLOR_CACHE.size > 200) {
    COLOR_CACHE.clear();
  }
  COLOR_CACHE.set(css, parsed);
  return parsed;
}

// ── Pen ────────────────────────────────────────────────────────────────────────
// Garis tajam, penuh, sensitif tekanan. Mirip bolpoin/liner.

export function drawPen(
  ctx: CanvasRenderingContext2D,
  from: BrushPoint,
  to: BrushPoint,
  size: number,
  color: string,
  isEraser: boolean,
  opacity: number = 1,
): void {
  const width = to.pressure !== 0.5
    ? Math.max(0.5, size * (0.3 + 0.7 * to.pressure))
    : size;

  ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.strokeStyle = isEraser ? "rgba(0,0,0,1)" : color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);

  if (from.x === to.x && from.y === to.y) {
    ctx.fillStyle = isEraser ? "rgba(0,0,0,1)" : color;
    ctx.arc(to.x, to.y, width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

// ── Round Brush ────────────────────────────────────────────────────────────────
// Kuas bulat lembut dengan sedikit transparansi di tepi, seperti kuas cat air tipis.

export function drawRoundBrush(
  ctx: CanvasRenderingContext2D,
  from: BrushPoint,
  to: BrushPoint,
  size: number,
  color: string,
  isEraser: boolean,
  opacity: number = 1,
): void {
  const width = to.pressure !== 0.5
    ? Math.max(1, size * (0.4 + 0.6 * to.pressure))
    : size;

  ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
  ctx.globalAlpha = (isEraser ? 0.9 : 0.88) * Math.max(0, Math.min(1, opacity));
  ctx.strokeStyle = isEraser ? "rgba(0,0,0,1)" : color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  if (from.x === to.x && from.y === to.y) {
    ctx.fillStyle = isEraser ? "rgba(0,0,0,1)" : color;
    ctx.arc(to.x, to.y, width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

// ── Flat Brush ────────────────────────────────────────────────────────────────
// Kuas pipih — lebar miring tegak lurus arah goresan, seperti kuas cat datar.

export function drawFlatBrush(
  ctx: CanvasRenderingContext2D,
  from: BrushPoint,
  to: BrushPoint,
  size: number,
  color: string,
  isEraser: boolean,
  opacity: number = 1,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;

  // Tegak lurus dari arah goresan
  const nx = -dy / length;
  const ny = dx / length;

  const halfW = (size * 0.8) / 2; // lebar pipih
  const halfH = (size * 0.18) / 2; // ketebalan tipis

  const alpha = (isEraser ? 1 : 0.92) * Math.max(0, Math.min(1, opacity));

  ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = isEraser ? "rgba(0,0,0,1)" : color;

  // Gambar quad di setiap segmen
  const steps = Math.max(1, Math.ceil(length / (halfH * 2)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = lerp(from.x, to.x, t);
    const cy = lerp(from.y, to.y, t);

    ctx.beginPath();
    ctx.moveTo(cx + nx * halfW - ny * halfH, cy + ny * halfW + nx * halfH);
    ctx.lineTo(cx + nx * halfW + ny * halfH, cy + ny * halfW - nx * halfH);
    ctx.lineTo(cx - nx * halfW + ny * halfH, cy - ny * halfW - nx * halfH);
    ctx.lineTo(cx - nx * halfW - ny * halfH, cy - ny * halfW + nx * halfH);
    ctx.closePath();
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

// ── Feather (Watercolor) ───────────────────────────────────────────────────────
// Goresan lembut, alpha rendah, tepi menyebar. Terasa seperti kuas basah.

export function drawFeather(
  ctx: CanvasRenderingContext2D,
  from: BrushPoint,
  to: BrushPoint,
  size: number,
  color: string,
  isEraser: boolean,
  opacity: number = 1,
): void {
  const d = dist(from, to);
  const steps = Math.max(1, Math.ceil(d / (size * 0.25)));
  const opFactor = Math.max(0, Math.min(1, opacity));

  ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
  const [cr, cg, cb] = isEraser ? [0, 0, 0] : parseColor(color);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = lerp(from.x, to.x, t);
    const y = lerp(from.y, to.y, t);
    const r = size * 0.55;

    if (isEraser) {
      ctx.globalAlpha = 0.06 * opFactor;
      ctx.fillStyle = "rgba(0,0,0,1)";
    } else {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${0.30 * opFactor})`);
      grad.addColorStop(0.55, `rgba(${cr},${cg},${cb},${0.10 * opFactor})`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = grad;
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

// ── Marker ────────────────────────────────────────────────────────────────────
// Spidol tebal, semi-transparan. Goresan kedua di atas pertama = lebih gelap.

export function drawMarker(
  ctx: CanvasRenderingContext2D,
  from: BrushPoint,
  to: BrushPoint,
  size: number,
  color: string,
  isEraser: boolean,
  opacity: number = 1,
): void {
  // Marker hampir tidak terpengaruh tekanan (konsisten)
  const width = to.pressure !== 0.5
    ? Math.max(2, size * (0.8 + 0.2 * to.pressure))
    : size;

  ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
  ctx.globalAlpha = (isEraser ? 1 : 0.55) * Math.max(0, Math.min(1, opacity));
  ctx.strokeStyle = isEraser ? "rgba(0,0,0,1)" : color;
  ctx.lineWidth = width;
  ctx.lineCap = "square"; // ujung persegi = khas spidol
  ctx.lineJoin = "miter";

  ctx.beginPath();
  if (from.x === to.x && from.y === to.y) {
    ctx.fillStyle = isEraser ? "rgba(0,0,0,1)" : color;
    ctx.fillRect(to.x - width / 2, to.y - width / 2, width, width);
  } else {
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

// ── Pencil ────────────────────────────────────────────────────────────────────
// Pensil — stroke sedikit berbulu/tekstur, seperti pensil di kertas.

export function drawPencil(
  ctx: CanvasRenderingContext2D,
  from: BrushPoint,
  to: BrushPoint,
  size: number,
  color: string,
  isEraser: boolean,
  opacity: number = 1,
): void {
  const d = dist(from, to);
  const steps = Math.max(2, Math.ceil(d / 2));
  const opFactor = Math.max(0, Math.min(1, opacity));
  const baseAlpha = (isEraser ? 0.18 : 0.22) * opFactor;

  ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";

  const [cr, cg, cb] = isEraser ? [0, 0, 0] : parseColor(color);
  const halfSize = Math.max(0.6, size * 0.38);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = lerp(from.x, to.x, t) + (Math.random() - 0.5) * 0.8;
    const y = lerp(from.y, to.y, t) + (Math.random() - 0.5) * 0.8;

    // Variasi jitter warna tipis untuk tekstur pensil
    const jitter = (Math.random() - 0.5) * 18;
    const rj = Math.min(255, Math.max(0, cr + jitter));
    const gj = Math.min(255, Math.max(0, cg + jitter));
    const bj = Math.min(255, Math.max(0, cb + jitter));

    ctx.globalAlpha = baseAlpha + Math.random() * (0.08 * opFactor);
    ctx.fillStyle = isEraser
      ? `rgba(0,0,0,1)`
      : `rgb(${Math.round(rj)},${Math.round(gj)},${Math.round(bj)})`;

    ctx.beginPath();
    ctx.arc(x, y, halfSize, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

// ── Airbrush Soft ─────────────────────────────────────────────────────────────
// Semprotan cat lembut — gradient radial, alpha sangat rendah per step,
// membangun warna secara natural saat ditahan atau digores pelan.

export function drawAirbrush(
  ctx: CanvasRenderingContext2D,
  from: BrushPoint,
  to: BrushPoint,
  size: number,
  color: string,
  isEraser: boolean,
  opacity: number = 1,
): void {
  const d = dist(from, to);
  // Langkah per jarak — airbrush lebih jarang agar tidak terlalu opak
  const steps = Math.max(1, Math.ceil(d / (size * 0.4)));
  const radius = size * 1.2;
  const opFactor = Math.max(0, Math.min(1, opacity));

  ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";

  const [cr, cg, cb] = isEraser ? [0, 0, 0] : parseColor(color);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = lerp(from.x, to.x, t);
    const y = lerp(from.y, to.y, t);

    // Scatter partikel kecil di dalam radius
    const particleCount = 6 + Math.floor(Math.random() * 6);
    for (let p = 0; p < particleCount; p++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;

      // Semakin jauh dari pusat, semakin transparan
      const falloff = 1 - (r / radius);
      ctx.globalAlpha = (isEraser
        ? falloff * 0.04
        : falloff * 0.035 * (0.7 + 0.3 * to.pressure)) * opFactor;
      ctx.fillStyle = isEraser
        ? "rgba(0,0,0,1)"
        : `rgb(${cr},${cg},${cb})`;

      const dotR = Math.max(0.5, Math.random() * 1.6);
      ctx.beginPath();
      ctx.arc(px, py, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
}

// ── Dispatcher utama ───────────────────────────────────────────────────────────
// Dipanggil oleh drawStrokeSegment di useDrawingCanvas.ts

export function dispatchBrush(
  brushType: string,
  ctx: CanvasRenderingContext2D,
  from: BrushPoint,
  to: BrushPoint,
  size: number,
  color: string,
  isEraser: boolean,
  opacity: number = 1,
): void {
  switch (brushType) {
    case "pen":      return drawPen(ctx, from, to, size, color, isEraser, opacity);
    case "round":    return drawRoundBrush(ctx, from, to, size, color, isEraser, opacity);
    case "flat":     return drawFlatBrush(ctx, from, to, size, color, isEraser, opacity);
    case "feather":  return drawFeather(ctx, from, to, size, color, isEraser, opacity);
    case "marker":   return drawMarker(ctx, from, to, size, color, isEraser, opacity);
    case "pencil2":  return drawPencil(ctx, from, to, size, color, isEraser, opacity);
    case "airbrush": return drawAirbrush(ctx, from, to, size, color, isEraser, opacity);
    // Fallback ke pen untuk tipe tak dikenal
    default:         return drawPen(ctx, from, to, size, color, isEraser, opacity);
  }
}
