// ─── Fungsi utilitas canvas yang murni (tidak bergantung React) ──────────────

// ── Color Conversion ──────────────────────────────────────────────────────────

export function hslStringToRgb(hslString: string): [number, number, number] {
  const match = hslString.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/);
  if (!match) return [0, 0, 0];

  const h = Number(match[1]);
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;

  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const vn = Math.max(0, Math.min(100, v)) / 100;
  const c = vn * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = vn - c;

  let r = 0;
  let g = 0;
  let b = 0;
  if (hp >= 0 && hp < 1) { r = c; g = x; b = 0; }
  else if (hp >= 1 && hp < 2) { r = x; g = c; b = 0; }
  else if (hp >= 2 && hp < 3) { r = 0; g = c; b = x; }
  else if (hp >= 3 && hp < 4) { r = 0; g = x; b = c; }
  else if (hp >= 4 && hp < 5) { r = x; g = 0; b = c; }
  else if (hp >= 5 && hp < 6) { r = c; g = 0; b = x; }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

export function hsvToRgbString(h: number, s: number, v: number): string {
  const [r, g, b] = hsvToRgb(h, s, v);
  return `rgb(${r}, ${g}, ${b})`;
}

export function rgbToHsv(r: number, g: number, b: number): { hue: number; sat: number; val: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
  }

  return {
    hue: Math.round(h * 360),
    sat: Math.round(s * 100),
    val: Math.round(v * 100),
  };
}

export function rgbToHsl(r: number, g: number, b: number): { hue: number; sat: number; val: number } {
  // Gunakan rgbToHsv yang konsisten dengan panel warna HSV
  return rgbToHsv(r, g, b);
}

// ── Flood Fill ────────────────────────────────────────────────────────────────

function colorsMatch(
  r1: number, g1: number, b1: number, a1: number,
  r2: number, g2: number, b2: number, a2: number,
  tolerance: number,
): boolean {
  return (
    Math.abs(r1 - r2) <= tolerance &&
    Math.abs(g1 - g2) <= tolerance &&
    Math.abs(b1 - b2) <= tolerance &&
    Math.abs(a1 - a2) <= tolerance
  );
}

export function floodFill(
  imageData: ImageData,
  startX: number,
  startY: number,
  fillColor: [number, number, number, number],
  tolerance: number,
): void {
  const { width, height, data } = imageData;
  const startIdx = (startY * width + startX) * 4;

  const startR = data[startIdx];
  const startG = data[startIdx + 1];
  const startB = data[startIdx + 2];
  const startA = data[startIdx + 3];

  // Jangan isi kalau warna target sama persis
  if (colorsMatch(startR, startG, startB, startA, fillColor[0], fillColor[1], fillColor[2], fillColor[3], 0)) {
    return;
  }

  const matches = (idx: number) =>
    colorsMatch(data[idx], data[idx + 1], data[idx + 2], data[idx + 3], startR, startG, startB, startA, tolerance);

  const visited = new Uint8Array(width * height);
  const stack: number[] = [startY * width + startX];

  while (stack.length > 0) {
    const pixelPos = stack.pop()!;
    if (visited[pixelPos]) continue;

    const y = Math.floor(pixelPos / width);
    const x = pixelPos % width;
    if (!matches(pixelPos * 4)) continue;

    // Scan baris kiri & kanan dari posisi saat ini
    let xLeft = x;
    while (xLeft > 0 && !visited[y * width + (xLeft - 1)] && matches((y * width + (xLeft - 1)) * 4)) {
      xLeft--;
    }

    let xRight = x;
    while (xRight < width - 1 && !visited[y * width + (xRight + 1)] && matches((y * width + (xRight + 1)) * 4)) {
      xRight++;
    }

    for (let xi = xLeft; xi <= xRight; xi++) {
      const p = y * width + xi;
      visited[p] = 1;

      const idx = p * 4;
      data[idx] = fillColor[0];
      data[idx + 1] = fillColor[1];
      data[idx + 2] = fillColor[2];
      data[idx + 3] = fillColor[3];

      if (y > 0 && !visited[(y - 1) * width + xi] && matches(((y - 1) * width + xi) * 4)) {
        stack.push((y - 1) * width + xi);
      }
      if (y < height - 1 && !visited[(y + 1) * width + xi] && matches(((y + 1) * width + xi) * 4)) {
        stack.push((y + 1) * width + xi);
      }
    }
  }
}

// ── Image Loading ─────────────────────────────────────────────────────────────

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// ── Canvas Helpers ────────────────────────────────────────────────────────────

export function createLayerCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  return canvas;
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nextAvailableName(existingNames: string[], prefix: string): string {
  let n = 1;
  while (existingNames.includes(`${prefix} ${n}`)) {
    n++;
  }
  return `${prefix} ${n}`;
}
