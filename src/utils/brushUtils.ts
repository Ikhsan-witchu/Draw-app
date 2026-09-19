// ─── Algoritma rendering per-tipe brush ──────────────────────────────────────
//
// Setiap fungsi menerima konteks layer canvas (OffscreenCanvas atau HTMLCanvas),
// tidak memanggil recomposite — itu tanggung jawab pemanggil.

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

/**
 * Parse warna CSS menjadi komponen r, g, b (0–255).
 * Mendukung format hsl(...) dan rgb(...).
 */
function parseColor(css: string): [number, number, number] {
  // Buat elemen canvas sementara untuk parsing via browser
  const tmp = document.createElement("canvas");
  tmp.width = 1;
  tmp.height = 1;
  const ctx = tmp.getContext("2d")!;
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
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
): void {
  const width = to.pressure !== 0.5
    ? Math.max(0.5, size * (0.3 + 0.7 * to.pressure))
    : size;

  ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
  ctx.globalAlpha = 1;
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
): void {
  const width = to.pressure !== 0.5
    ? Math.max(1, size * (0.4 + 0.6 * to.pressure))
    : size;

  ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
  ctx.globalAlpha = isEraser ? 0.9 : 0.88;
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
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;

  // Tegak lurus dari arah goresan
  const nx = -dy / length;
  const ny = dx / length;

  const halfW = (size * 0.8) / 2; // lebar pipih
  const halfH = (size * 0.18) / 2; // ketebalan tipis

  const alpha = isEraser ? 1 : 0.92;

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
): void {
  const d = dist(from, to);
  const steps = Math.max(1, Math.ceil(d / (size * 0.25)));

  ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = lerp(from.x, to.x, t);
    const y = lerp(from.y, to.y, t);
    const r = size * 0.55;

    if (isEraser) {
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = "rgba(0,0,0,1)";
    } else {
      const [cr, cg, cb] = parseColor(color);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},0.30)`);
      grad.addColorStop(0.55, `rgba(${cr},${cg},${cb},0.10)`);
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
): void {
  // Marker hampir tidak terpengaruh tekanan (konsisten)
  const width = to.pressure !== 0.5
    ? Math.max(2, size * (0.8 + 0.2 * to.pressure))
    : size;

  ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
  ctx.globalAlpha = isEraser ? 1 : 0.55;
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
): void {
  const d = dist(from, to);
  const steps = Math.max(2, Math.ceil(d / 2));
  const baseAlpha = isEraser ? 0.18 : 0.22;

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

    ctx.globalAlpha = baseAlpha + Math.random() * 0.08;
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
): void {
  const d = dist(from, to);
  // Langkah per jarak — airbrush lebih jarang agar tidak terlalu opak
  const steps = Math.max(1, Math.ceil(d / (size * 0.4)));
  const radius = size * 1.2;

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
      ctx.globalAlpha = isEraser
        ? falloff * 0.04
        : falloff * 0.035 * (0.7 + 0.3 * to.pressure);
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
): void {
  switch (brushType) {
    case "pen":      return drawPen(ctx, from, to, size, color, isEraser);
    case "round":    return drawRoundBrush(ctx, from, to, size, color, isEraser);
    case "flat":     return drawFlatBrush(ctx, from, to, size, color, isEraser);
    case "feather":  return drawFeather(ctx, from, to, size, color, isEraser);
    case "marker":   return drawMarker(ctx, from, to, size, color, isEraser);
    case "pencil2":  return drawPencil(ctx, from, to, size, color, isEraser);
    case "airbrush": return drawAirbrush(ctx, from, to, size, color, isEraser);
    // Fallback ke pen untuk tipe tak dikenal
    default:         return drawPen(ctx, from, to, size, color, isEraser);
  }
}
