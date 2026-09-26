// ─── Hook: Selection Tool (Rect & Lasso) ────────────────────────────────────
// Mengelola state selection rectangle / lasso, marching ants animation,
// dan operasi Cut / Copy / Fill / Clear pada area terpilih.

import { useState, useCallback, useRef, useEffect } from "react";
import type { TabStore, LayerMeta } from "../types/drawing";

export type SelectionMode = "rect" | "lasso";

export interface RectSelection {
  mode: "rect";
  x: number;   // document coords
  y: number;
  w: number;
  h: number;
}

export interface LassoSelection {
  mode: "lasso";
  points: { x: number; y: number }[]; // document coords path
}

export type Selection = RectSelection | LassoSelection;

export interface SelectionState {
  active: boolean;           // ada selection yang committed (selesai dibuat)
  drawing: boolean;          // sedang drag membuat selection baru
  selection: Selection | null;
  // Untuk lasso sementara saat drag
  lassoPoints: { x: number; y: number }[];
  // Untuk rect sementara saat drag
  dragStart: { x: number; y: number } | null;
  dragCurrent: { x: number; y: number } | null;
}

interface UseSelectionToolParams {
  tool: string;
  color: string;
  getActiveStore: () => TabStore | undefined;
  activeLayerId: string | null;
  layers: LayerMeta[];
  pushHistory: () => void;
  recomposite: () => void;
  persistActiveLayerContent: () => void;
}

export function useSelectionTool({
  tool,
  color,
  getActiveStore,
  activeLayerId,
  layers,
  pushHistory,
  recomposite,
  persistActiveLayerContent,
}: UseSelectionToolParams) {
  const [selState, setSelState] = useState<SelectionState>({
    active: false,
    drawing: false,
    selection: null,
    lassoPoints: [],
    dragStart: null,
    dragCurrent: null,
  });

  // Marching ants offset (animasi)
  const [dashOffset, setDashOffset] = useState(0);
  const animFrameRef = useRef<number | null>(null);

  // Animasi marching ants saat ada selection aktif
  useEffect(() => {
    if (selState.active || selState.drawing) {
      let offset = 0;
      const tick = () => {
        offset = (offset + 0.5) % 16;
        setDashOffset(offset);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
      return () => {
        if (animFrameRef.current != null) {
          cancelAnimationFrame(animFrameRef.current);
        }
      };
    }
  }, [selState.active, selState.drawing]);

  // Tutup selection saat tool berganti
  useEffect(() => {
    if (tool !== "rect" && tool !== "lasso") {
      setSelState((prev) => {
        if (!prev.active && !prev.drawing && !prev.selection) return prev;
        return {
          active: false,
          drawing: false,
          selection: null,
          lassoPoints: [],
          dragStart: null,
          dragCurrent: null,
        };
      });
    }
  }, [tool]);


  // ── Pointer handlers ──────────────────────────────────────────────────────

  const handleSelectionPointerDown = useCallback(
    (docX: number, docY: number) => {
      if (tool !== "rect" && tool !== "lasso") return;

      // Klik baru memulai selection → clear selection lama
      setSelState({
        active: false,
        drawing: true,
        selection: null,
        lassoPoints: tool === "lasso" ? [{ x: docX, y: docY }] : [],
        dragStart: { x: docX, y: docY },
        dragCurrent: { x: docX, y: docY },
      });
    },
    [tool],
  );

  const handleSelectionPointerMove = useCallback(
    (docX: number, docY: number) => {
      if (tool !== "rect" && tool !== "lasso") return;

      setSelState((prev) => {
        if (!prev.drawing) return prev;
        if (tool === "rect") {
          return { ...prev, dragCurrent: { x: docX, y: docY } };
        } else {
          // Lasso: tambah titik hanya jika pindah > 2px dari titik terakhir
          const last = prev.lassoPoints[prev.lassoPoints.length - 1];
          if (last) {
            const dx = docX - last.x;
            const dy = docY - last.y;
            if (dx * dx + dy * dy < 4) return prev; // terlalu dekat, skip
          }
          return {
            ...prev,
            dragCurrent: { x: docX, y: docY },
            lassoPoints: [...prev.lassoPoints, { x: docX, y: docY }],
          };
        }
      });
    },
    [tool],
  );

  const handleSelectionPointerUp = useCallback(
    (docX: number, docY: number) => {
      if (tool !== "rect" && tool !== "lasso") return;

      setSelState((prev) => {
        if (!prev.drawing) return prev;

        if (tool === "rect") {
          const start = prev.dragStart;
          if (!start) return { ...prev, drawing: false };

          const x = Math.min(start.x, docX);
          const y = Math.min(start.y, docY);
          const w = Math.abs(docX - start.x);
          const h = Math.abs(docY - start.y);

          if (w < 2 && h < 2) {
            // Terlalu kecil → batalkan
            return {
              active: false,
              drawing: false,
              selection: null,
              lassoPoints: [],
              dragStart: null,
              dragCurrent: null,
            };
          }

          return {
            active: true,
            drawing: false,
            selection: { mode: "rect", x, y, w, h },
            lassoPoints: [],
            dragStart: null,
            dragCurrent: { x: docX, y: docY },
          };
        } else {
          // Lasso: tutup path
          const pts = [...prev.lassoPoints, { x: docX, y: docY }];
          if (pts.length < 3) {
            return {
              active: false,
              drawing: false,
              selection: null,
              lassoPoints: [],
              dragStart: null,
              dragCurrent: null,
            };
          }

          return {
            active: true,
            drawing: false,
            selection: { mode: "lasso", points: pts },
            lassoPoints: pts,
            dragStart: null,
            dragCurrent: { x: docX, y: docY },
          };
        }
      });
    },
    [tool],
  );

  // ── Helper: buat clipping context untuk lasso ──────────────────────────────
  function applyLassoClip(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.clip();
  }

  // ── Operasi ─────────────────────────────────────────────────────────────────

  const clearSelection = useCallback(() => {
    setSelState({
      active: false,
      drawing: false,
      selection: null,
      lassoPoints: [],
      dragStart: null,
      dragCurrent: null,
    });
  }, []);

  const fillSelection = useCallback(() => {
    const store = getActiveStore();
    if (!store || !activeLayerId || !selState.selection) return;

    const activeLayerMeta = layers.find((l) => l.id === activeLayerId);
    if (activeLayerMeta?.locked || !activeLayerMeta?.visible) return;

    const layerCanvas = store.layerCanvases.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!ctx || !layerCanvas) return;

    pushHistory();
    ctx.save();

    if (selState.selection.mode === "rect") {
      const { x, y, w, h } = selState.selection;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    } else {
      const { points } = selState.selection;
      applyLassoClip(ctx, points);
      ctx.fillStyle = color;
      ctx.fill();
    }

    ctx.restore();
    recomposite();
    persistActiveLayerContent();
  }, [
    getActiveStore,
    activeLayerId,
    layers,
    selState.selection,
    pushHistory,
    recomposite,
    persistActiveLayerContent,
    color,
  ]);

  const eraseSelection = useCallback(() => {
    const store = getActiveStore();
    if (!store || !activeLayerId || !selState.selection) return;

    const activeLayerMeta = layers.find((l) => l.id === activeLayerId);
    if (activeLayerMeta?.locked || !activeLayerMeta?.visible) return;

    const layerCanvas = store.layerCanvases.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!ctx || !layerCanvas) return;

    pushHistory();
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";

    if (selState.selection.mode === "rect") {
      const { x, y, w, h } = selState.selection;
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fillRect(x, y, w, h);
    } else {
      const { points } = selState.selection;
      applyLassoClip(ctx, points);
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fill();
    }

    ctx.restore();
    recomposite();
    persistActiveLayerContent();
  }, [
    getActiveStore,
    activeLayerId,
    layers,
    selState.selection,
    pushHistory,
    recomposite,
    persistActiveLayerContent,
  ]);

  /** Salin area terpilih ke clipboard sebagai PNG */
  const copySelection = useCallback(
    async (cut = false) => {
      const store = getActiveStore();
      if (!store || !selState.selection) return;

      // Komposit semua layer ke satu temp canvas dulu
      const mainCanvas = document.createElement("canvas");
      mainCanvas.width = store.width;
      mainCanvas.height = store.height;
      const mCtx = mainCanvas.getContext("2d");
      if (!mCtx) return;

      // Gambar semua layer
      for (let i = store.layers.length - 1; i >= 0; i--) {
        const layer = store.layers[i];
        if (!layer.visible) continue;
        const lc = store.layerCanvases.get(layer.id);
        if (lc) {
          mCtx.globalAlpha = (layer.opacity ?? 100) / 100;
          mCtx.drawImage(lc, 0, 0);
        }
      }
      mCtx.globalAlpha = 1;

      // Extract area ke temp canvas
      let cropCanvas: HTMLCanvasElement;

      if (selState.selection.mode === "rect") {
        const { x, y, w, h } = selState.selection;
        cropCanvas = document.createElement("canvas");
        cropCanvas.width = Math.max(1, Math.round(w));
        cropCanvas.height = Math.max(1, Math.round(h));
        const cCtx = cropCanvas.getContext("2d");
        cCtx?.drawImage(mainCanvas, Math.round(x), Math.round(y), Math.round(w), Math.round(h), 0, 0, cropCanvas.width, cropCanvas.height);
      } else {
        const { points } = selState.selection;
        // Bounding box of lasso
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        const minX = Math.floor(Math.min(...xs));
        const minY = Math.floor(Math.min(...ys));
        const maxX = Math.ceil(Math.max(...xs));
        const maxY = Math.ceil(Math.max(...ys));
        const w = Math.max(1, maxX - minX);
        const h = Math.max(1, maxY - minY);

        cropCanvas = document.createElement("canvas");
        cropCanvas.width = w;
        cropCanvas.height = h;
        const cCtx = cropCanvas.getContext("2d");
        if (cCtx) {
          cCtx.translate(-minX, -minY);
          applyLassoClip(cCtx, points);
          cCtx.drawImage(mainCanvas, 0, 0);
        }
      }

      // Copy ke clipboard
      cropCanvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
        } catch {
          // Fallback: download
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "selection.png";
          a.click();
          URL.revokeObjectURL(url);
        }
      }, "image/png");

      // Jika Cut, hapus area setelah copy
      if (cut) {
        eraseSelection();
      }
    },
    [getActiveStore, selState.selection, eraseSelection],
  );

  // Keyboard shortcut: Escape → clear selection
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && selState.active) {
        clearSelection();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selState.active, clearSelection]);

  return {
    selState,
    dashOffset,
    handleSelectionPointerDown,
    handleSelectionPointerMove,
    handleSelectionPointerUp,
    clearSelection,
    fillSelection,
    eraseSelection,
    copySelection,
  };
}
