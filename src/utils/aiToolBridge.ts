// ─── Bridging antara AI Tool Recommendation dan Setter Aplikasi ──────────────

import type { ToolRecommendation } from "../types/ai";
import { rgbToHsl } from "./canvasUtils";

/**
 * Konversi warna format HEX (#RRGGBB atau #RGB) ke format HSL { hue, sat, val }.
 */
export function hexToHsl(hex: string): { hue: number; sat: number; val: number } {
  const cleanHex = hex.replace(/^#/, "");
  let r = 0;
  let g = 0;
  let b = 0;

  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16) || 0;
    g = parseInt(cleanHex[1] + cleanHex[1], 16) || 0;
    b = parseInt(cleanHex[2] + cleanHex[2], 16) || 0;
  } else if (cleanHex.length >= 6) {
    r = parseInt(cleanHex.slice(0, 2), 16) || 0;
    g = parseInt(cleanHex.slice(2, 4), 16) || 0;
    b = parseInt(cleanHex.slice(4, 6), 16) || 0;
  }

  return rgbToHsl(r, g, b);
}

export interface WorkspaceToolSetters {
  setActiveTool: (tool: string) => void;
  setActiveBrush: (brush: string) => void;
  setBrushSize: (size: number) => void;
  setBrushOpacity: (opacity: number) => void;
  handleColorPick: (hsl: { hue: number; sat: number; val: number }) => void;
}

/**
 * Menerapkan rekomendasi tool dari AI ke state aplikasi yang sudah ada.
 */
export function applyToolRecommendation(
  rec: ToolRecommendation,
  setters: WorkspaceToolSetters,
): void {
  // 1. Terapkan Tool utama
  if (rec.tool) {
    setters.setActiveTool(rec.tool);
  }

  // 2. Terapkan Tipe Brush jika ada (hanya relevan untuk brush & eraser)
  if (rec.brush_type) {
    setters.setActiveBrush(rec.brush_type);
  }

  // 3. Terapkan Ukuran Brush
  if (typeof rec.brush_size_px === "number" && rec.brush_size_px > 0) {
    setters.setBrushSize(Math.max(1, Math.min(128, rec.brush_size_px)));
  }

  // 4. Terapkan Opacity Brush
  if (typeof rec.opacity_percent === "number" && rec.opacity_percent > 0) {
    setters.setBrushOpacity(Math.max(1, Math.min(100, rec.opacity_percent)));
  }

  // 5. Terapkan Warna jika ada
  if (rec.color_hex) {
    const hsl = hexToHsl(rec.color_hex);
    setters.handleColorPick(hsl);
  }
}

/**
 * Pesan konfirmasi sistem saat saran diterapkan (untuk histori chat AI).
 */
export function createAppliedConfirmation(rec: ToolRecommendation): string {
  const parts = [
    `Tool: ${rec.tool}`,
    rec.brush_type ? `Kuas: ${rec.brush_type}` : null,
    `Ukuran: ${rec.brush_size_px}px`,
    `Opacity: ${rec.opacity_percent}%`,
    rec.color_hex ? `Warna: ${rec.color_hex}` : null,
  ].filter(Boolean);

  return `[Sistem] Rekomendasi diterapkan (${parts.join(", ")}).`;
}

/**
 * Pesan konfirmasi sistem saat saran dilewati.
 */
export function createSkippedConfirmation(rec: ToolRecommendation): string {
  return `[Sistem] Rekomendasi (${rec.tool}${rec.brush_type ? ` - ${rec.brush_type}` : ""}) dilewati oleh user.`;
}
