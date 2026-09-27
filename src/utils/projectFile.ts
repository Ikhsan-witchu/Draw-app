import JSZip from "jszip";
import type { LayerMeta, AnimationFrame } from "../types/drawing";
import { createLayerCanvas } from "./canvasUtils";

// ── Tipe manifest proyek ──
interface DwpManifest {
  appVersion: string;
  formatVersion: number;
  width: number;
  height: number;
  activeLayerId: string | null;
  layers: LayerMeta[];
  animation: {
    fps: number;
    currentFrameIndex: number;
    frameCount: number;
    onionSkinEnabled: boolean;
  };
}

// ── Hasil load proyek ──
export interface LoadedProject {
  width: number;
  height: number;
  layers: LayerMeta[];
  activeLayerId: string | null;
  layerCanvases: Map<string, HTMLCanvasElement>;
  frames: AnimationFrame[];
  fps: number;
  currentFrameIndex: number;
  onionSkinEnabled: boolean;
}

// ── Helper: Convert canvas to PNG blob ──
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Gagal mengkonversi canvas ke blob"));
      },
      "image/png",
    );
  });
}

// ── Helper: Load image dari blob ──
function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal memuat gambar dari blob"));
    };
    img.src = url;
  });
}

// ── SAVE PROJECT ──
export async function saveProject(options: {
  title: string;
  width: number;
  height: number;
  layers: LayerMeta[];
  activeLayerId: string | null;
  layerCanvases: Map<string, HTMLCanvasElement>;
  frames?: AnimationFrame[];
  fps?: number;
  currentFrameIndex?: number;
  onionSkinEnabled?: boolean;
}): Promise<void> {
  const zip = new JSZip();

  const manifest: DwpManifest = {
    appVersion: "1.0.0",
    formatVersion: 1,
    width: options.width,
    height: options.height,
    activeLayerId: options.activeLayerId,
    layers: options.layers.map((l) => ({ ...l })),
    animation: {
      fps: options.fps ?? 6,
      currentFrameIndex: options.currentFrameIndex ?? 0,
      frameCount: options.frames?.length ?? 0,
      onionSkinEnabled: options.onionSkinEnabled ?? false,
    },
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // Simpan thumbnail (scale down ke 256px)
  const thumbCanvas = document.createElement("canvas");
  const maxDim = 256;
  const ratio = Math.min(maxDim / options.width, maxDim / options.height);
  thumbCanvas.width = Math.round(options.width * ratio);
  thumbCanvas.height = Math.round(options.height * ratio);
  const thumbCtx = thumbCanvas.getContext("2d");
  if (thumbCtx) {
    thumbCtx.fillStyle = "#ffffff";
    thumbCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
    // Composite semua layer visible
    for (let i = options.layers.length - 1; i >= 0; i--) {
      const layer = options.layers[i];
      if (!layer.visible) continue;
      const lc = options.layerCanvases.get(layer.id);
      if (lc) {
        thumbCtx.globalAlpha = (layer.opacity ?? 100) / 100;
        thumbCtx.drawImage(lc, 0, 0, thumbCanvas.width, thumbCanvas.height);
      }
    }
    thumbCtx.globalAlpha = 1;
    const thumbBlob = await canvasToBlob(thumbCanvas);
    zip.file("thumbnail.png", thumbBlob);
  }

  // Simpan layer canvases (frame utama / frame aktif)
  const layersFolder = zip.folder("layers")!;
  for (const layer of options.layers) {
    const canvas = options.layerCanvases.get(layer.id);
    if (canvas) {
      const blob = await canvasToBlob(canvas);
      layersFolder.file(`${layer.id}.png`, blob);
    }
  }

  // Simpan frame animasi (jika ada lebih dari 1 frame)
  if (options.frames && options.frames.length > 0) {
    const framesFolder = zip.folder("frames")!;
    for (let fIdx = 0; fIdx < options.frames.length; fIdx++) {
      const frame = options.frames[fIdx];
      const frameFolder = framesFolder.folder(`frame-${fIdx}`)!;
      for (const layer of options.layers) {
        const canvas = frame.layerCanvases.get(layer.id);
        if (canvas) {
          const blob = await canvasToBlob(canvas);
          frameFolder.file(`${layer.id}.png`, blob);
        }
      }
    }
  }

  // Generate dan download
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${options.title || "project"}.dwp`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── LOAD PROJECT ──
export async function loadProject(file: File): Promise<LoadedProject> {
  const zip = await JSZip.loadAsync(file);

  // Baca manifest
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    throw new Error("File proyek tidak valid: manifest.json tidak ditemukan.");
  }
  const manifestText = await manifestFile.async("text");
  const manifest: DwpManifest = JSON.parse(manifestText);

  // Load layer canvases
  const layerCanvases = new Map<string, HTMLCanvasElement>();
  for (const layer of manifest.layers) {
    const pngFile = zip.file(`layers/${layer.id}.png`);
    if (pngFile) {
      const pngBlob = await pngFile.async("blob");
      const img = await loadImageFromBlob(pngBlob);
      const canvas = createLayerCanvas(manifest.width, manifest.height);
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      layerCanvases.set(layer.id, canvas);
    } else {
      // Layer tanpa data pixel — buat canvas kosong
      layerCanvases.set(layer.id, createLayerCanvas(manifest.width, manifest.height));
    }
  }

  // Load animation frames
  const frames: AnimationFrame[] = [];
  if (manifest.animation.frameCount > 0) {
    for (let fIdx = 0; fIdx < manifest.animation.frameCount; fIdx++) {
      const frameCanvases = new Map<string, HTMLCanvasElement>();
      for (const layer of manifest.layers) {
        const pngFile = zip.file(`frames/frame-${fIdx}/${layer.id}.png`);
        if (pngFile) {
          const pngBlob = await pngFile.async("blob");
          const img = await loadImageFromBlob(pngBlob);
          const canvas = createLayerCanvas(manifest.width, manifest.height);
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0);
          frameCanvases.set(layer.id, canvas);
        } else {
          frameCanvases.set(layer.id, createLayerCanvas(manifest.width, manifest.height));
        }
      }
      frames.push({
        id: `frame-${fIdx}`,
        name: `Frame ${fIdx + 1}`,
        layerCanvases: frameCanvases,
      });
    }
  }

  return {
    width: manifest.width,
    height: manifest.height,
    layers: manifest.layers,
    activeLayerId: manifest.activeLayerId,
    layerCanvases,
    frames,
    fps: manifest.animation.fps,
    currentFrameIndex: manifest.animation.currentFrameIndex,
    onionSkinEnabled: manifest.animation.onionSkinEnabled,
  };
}
