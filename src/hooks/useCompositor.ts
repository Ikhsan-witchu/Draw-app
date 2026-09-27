import { useCallback } from "react";
import type { LayerMeta, TabStore } from "../types/drawing";

interface UseCompositorOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  scratchCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  scratchPreviewCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  scratchOpacityRef: React.MutableRefObject<number>;
  groupCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  clipBufferRef: React.MutableRefObject<HTMLCanvasElement | null>;
  baseMaskCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  getActiveStore: () => TabStore | undefined;
  activeLayerId: string | null;
  layers: LayerMeta[];
  getReusableCanvas: (ref: React.MutableRefObject<HTMLCanvasElement | null>, w: number, h: number) => HTMLCanvasElement;
}

export function useCompositor({
  canvasRef,
  ctxRef,
  scratchCanvasRef,
  scratchPreviewCanvasRef,
  scratchOpacityRef,
  groupCanvasRef,
  clipBufferRef,
  baseMaskCanvasRef,
  getActiveStore,
  activeLayerId,
  layers,
  getReusableCanvas,
}: UseCompositorOptions) {
  // ── Helper: Render konten layer bersama scratch canvas jika sedang ada goresan ──
  const renderLayerContentToContext = useCallback(
    (
      targetCtx: CanvasRenderingContext2D,
      layer: LayerMeta,
      layerCanvas: HTMLCanvasElement,
      w: number,
      h: number,
    ) => {
      if (scratchCanvasRef.current && layer.id === activeLayerId) {
        const scratchPreview = getReusableCanvas(scratchPreviewCanvasRef, w, h);
        const spCtx = scratchPreview.getContext("2d");
        if (spCtx) {
          spCtx.clearRect(0, 0, w, h);
          spCtx.drawImage(layerCanvas, 0, 0, w, h);
          spCtx.save();
          spCtx.globalAlpha = scratchOpacityRef.current;
          if (layer.alphaLocked) {
            spCtx.globalCompositeOperation = "source-atop";
          }
          spCtx.drawImage(scratchCanvasRef.current, 0, 0, w, h);
          spCtx.restore();

          targetCtx.drawImage(scratchPreview, 0, 0, w, h);
        }
      } else {
        targetCtx.drawImage(layerCanvas, 0, 0, w, h);
      }
    },
    [activeLayerId, getReusableCanvas, scratchCanvasRef, scratchOpacityRef, scratchPreviewCanvasRef]
  );

  // ── Compositing: gabungkan semua layer yang visible ke main canvas ──
  const recomposite = useCallback(() => {
    const store = getActiveStore();
    if (!store) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (canvas.width !== store.width || canvas.height !== store.height || !ctxRef.current) {
      canvas.width = store.width;
      canvas.height = store.height;
      const ctx = canvas.getContext("2d", { alpha: false }); // optimization
      if (ctx) {
        ctxRef.current = ctx;
      }
    }

    const ctx = ctxRef.current;
    if (!ctx) return;

    const currentLayers = store.layers && store.layers.length > 0 ? store.layers : layers;
    if (!currentLayers || currentLayers.length === 0) return;

    ctx.clearRect(0, 0, store.width, store.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, store.width, store.height);

    // ── Onion Skinning (Bayangan Frame Sebelum & Sesudah) ──
    if (store.onionSkinEnabled && store.frames && store.frames.length > 1) {
      const curIdx = store.currentFrameIndex ?? 0;
      const prevIdx = curIdx - 1;
      const nextIdx = curIdx + 1;

      if (prevIdx >= 0) {
        const prevFrame = store.frames[prevIdx];
        if (prevFrame) {
          ctx.save();
          ctx.globalAlpha = 0.35;
          for (let lIdx = currentLayers.length - 1; lIdx >= 0; lIdx--) {
            const l = currentLayers[lIdx];
            if (!l.visible || l.name === "Background") continue;
            const prevLc = prevFrame.layerCanvases.get(l.id);
            if (prevLc) {
              ctx.drawImage(prevLc, 0, 0, store.width, store.height);
            }
          }
          ctx.restore();
        }
      }

      if (nextIdx < store.frames.length) {
        const nextFrame = store.frames[nextIdx];
        if (nextFrame) {
          ctx.save();
          ctx.globalAlpha = 0.25;
          for (let lIdx = currentLayers.length - 1; lIdx >= 0; lIdx--) {
            const l = currentLayers[lIdx];
            if (!l.visible || l.name === "Background") continue;
            const nextLc = nextFrame.layerCanvases.get(l.id);
            if (nextLc) {
              ctx.drawImage(nextLc, 0, 0, store.width, store.height);
            }
          }
          ctx.restore();
        }
      }
    }

    let i = currentLayers.length - 1;
    while (i >= 0) {
      const baseLayer = currentLayers[i];
      if (!baseLayer.visible) {
        // Skip base layer beserta seluruh layer yang di-clip ke atasnya
        let j = i - 1;
        while (j >= 0 && currentLayers[j].clipped) {
          j--;
        }
        i = j;
        continue;
      }

      // Cari rantai layer kliping tepat di atas baseLayer ini
      let j = i - 1;
      let hasClipped = false;
      while (j >= 0 && currentLayers[j].clipped) {
        if (currentLayers[j].visible) {
          hasClipped = true;
        }
        j--;
      }

      const baseCanvas = store.layerCanvases.get(baseLayer.id);
      if (!baseCanvas) {
        i = j;
        continue;
      }

      if (!hasClipped) {
        // Layer biasa tanpa kliping
        ctx.globalAlpha = (baseLayer.opacity ?? 100) / 100;
        ctx.globalCompositeOperation = baseLayer.blendMode ?? "source-over";
        renderLayerContentToContext(ctx, baseLayer, baseCanvas, store.width, store.height);
      } else {
        // Ada grup kliping mask!
        const groupCanvas = getReusableCanvas(groupCanvasRef, store.width, store.height);
        const gCtx = groupCanvas.getContext("2d");
        
        // Buffer yang khusus menyimpan siluet base layer
        const baseMaskBuffer = getReusableCanvas(baseMaskCanvasRef, store.width, store.height);
        const bmCtx = baseMaskBuffer.getContext("2d");

        if (gCtx && bmCtx) {
          gCtx.clearRect(0, 0, store.width, store.height);
          bmCtx.clearRect(0, 0, store.width, store.height);

          bmCtx.globalAlpha = 1;
          bmCtx.globalCompositeOperation = "source-over";
          renderLayerContentToContext(bmCtx, baseLayer, baseCanvas, store.width, store.height);

          gCtx.globalAlpha = 1;
          gCtx.globalCompositeOperation = "source-over";
          gCtx.drawImage(baseMaskBuffer, 0, 0, store.width, store.height);

          for (let k = i - 1; k > j; k--) {
            const clippedLayer = currentLayers[k];
            if (!clippedLayer.visible) continue;
            const clippedCanvas = store.layerCanvases.get(clippedLayer.id);
            if (!clippedCanvas) continue;

            const clipBuffer = getReusableCanvas(clipBufferRef, store.width, store.height);
            const cCtx = clipBuffer.getContext("2d");
            if (cCtx) {
              cCtx.clearRect(0, 0, store.width, store.height);

              cCtx.globalAlpha = (clippedLayer.opacity ?? 100) / 100;
              cCtx.globalCompositeOperation = "source-over";
              renderLayerContentToContext(cCtx, clippedLayer, clippedCanvas, store.width, store.height);

              cCtx.globalAlpha = 1;
              cCtx.globalCompositeOperation = "destination-in";
              cCtx.drawImage(baseMaskBuffer, 0, 0, store.width, store.height);

              gCtx.globalAlpha = 1;
              gCtx.globalCompositeOperation = clippedLayer.blendMode ?? "source-over";
              gCtx.drawImage(clipBuffer, 0, 0, store.width, store.height);
            }
          }

          ctx.globalAlpha = (baseLayer.opacity ?? 100) / 100;
          ctx.globalCompositeOperation = baseLayer.blendMode ?? "source-over";
          ctx.drawImage(groupCanvas, 0, 0, store.width, store.height);
        }
      }

      i = j;
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }, [
    activeLayerId,
    baseMaskCanvasRef,
    canvasRef,
    clipBufferRef,
    ctxRef,
    getActiveStore,
    getReusableCanvas,
    groupCanvasRef,
    layers,
    renderLayerContentToContext,
  ]);

  // ── Compositing Cepat (Dirty Rect) ──
  const recompositeRect = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const store = getActiveStore();
      if (!store || !ctxRef.current || w <= 0 || h <= 0) return;

      const currentLayers = store.layers && store.layers.length > 0 ? store.layers : layers;
      
      const hasAnyClipping = currentLayers.some((l) => l.clipped);
      if (hasAnyClipping) {
        recomposite();
        return;
      }

      const ctx = ctxRef.current;
      const x0 = Math.max(0, Math.floor(x));
      const y0 = Math.max(0, Math.floor(y));
      const x1 = Math.min(store.width, Math.ceil(x + w));
      const y1 = Math.min(store.height, Math.ceil(y + h));
      const rw = x1 - x0;
      const rh = y1 - y0;
      if (rw <= 0 || rh <= 0) return;

      if (!currentLayers || currentLayers.length === 0) return;

      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, rw, rh);
      ctx.clip();

      ctx.clearRect(x0, y0, rw, rh);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x0, y0, rw, rh);

      for (let i = currentLayers.length - 1; i >= 0; i--) {
        const layer = currentLayers[i];
        if (!layer.visible) continue;
        const layerCanvas = store.layerCanvases.get(layer.id);
        if (layerCanvas) {
          ctx.globalAlpha = (layer.opacity ?? 100) / 100;
          ctx.globalCompositeOperation = layer.blendMode ?? "source-over";
          
          if (scratchCanvasRef.current && layer.id === activeLayerId) {
            const scratchPreview = getReusableCanvas(scratchPreviewCanvasRef, store.width, store.height);
            const spCtx = scratchPreview.getContext("2d");
            if (spCtx) {
              spCtx.clearRect(x0, y0, rw, rh);
              spCtx.drawImage(layerCanvas, x0, y0, rw, rh, x0, y0, rw, rh);
              spCtx.save();
              spCtx.globalAlpha = scratchOpacityRef.current;
              if (layer.alphaLocked) {
                spCtx.globalCompositeOperation = "source-atop";
              }
              spCtx.drawImage(scratchCanvasRef.current, x0, y0, rw, rh, x0, y0, rw, rh);
              spCtx.restore();
              
              ctx.drawImage(scratchPreview, x0, y0, rw, rh, x0, y0, rw, rh);
            }
          } else {
            ctx.drawImage(layerCanvas, x0, y0, rw, rh, x0, y0, rw, rh);
          }
        }
      }

      ctx.restore();
    },
    [
      activeLayerId,
      ctxRef,
      getActiveStore,
      getReusableCanvas,
      layers,
      recomposite,
      scratchCanvasRef,
      scratchOpacityRef,
      scratchPreviewCanvasRef,
    ]
  );

  return { recomposite, recompositeRect, renderLayerContentToContext };
}
