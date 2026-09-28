// ─── Hook: Selection Tool (Rect & Lasso) ────────────────────────────────────
// Mengelola state selection rectangle / lasso, marching ants animation,
// dan operasi Cut / Copy / Fill / Clear / Move pada area terpilih.

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

export interface MoveState {
  active: boolean;
  /** Canvas berisi piksel yang sedang dipindah */
  floatingCanvas: HTMLCanvasElement | null;
  /** Offset awal dari bounding-box selection (document coords) */
  originX: number;
  originY: number;
  /** Posisi saat ini (document coords) */
  currentX: number;
  currentY: number;
  /** Apakah sedang di-drag */
  dragging: boolean;
  /** Posisi pointer saat drag dimulai */
  dragStartDocX: number;
  dragStartDocY: number;
  /** Posisi origin saat drag dimulai */
  dragOriginX: number;
  dragOriginY: number;
}

export interface SelectionState {
  active: boolean;           // ada selection yang committed (selesai dibuat)
  drawing: boolean;          // sedang drag membuat selection baru
  selection: Selection | null;
  // Untuk lasso sementara saat drag
  lassoPoints: { x: number; y: number }[];
  // Untuk rect sementara saat drag
  dragStart: { x: number; y: number } | null;
  dragCurrent: { x: number; y: number } | null;
  // Move state
  move: MoveState;
}

const EMPTY_MOVE: MoveState = {
  active: false,
  floatingCanvas: null,
  originX: 0,
  originY: 0,
  currentX: 0,
  currentY: 0,
  dragging: false,
  dragStartDocX: 0,
  dragStartDocY: 0,
  dragOriginX: 0,
  dragOriginY: 0,
};

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
    move: { ...EMPTY_MOVE },
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
        // Jika sedang move, commit dulu
        if (prev.move.active && prev.move.floatingCanvas) {
          commitMoveInternal(prev);
        }
        return {
          active: false,
          drawing: false,
          selection: null,
          lassoPoints: [],
          dragStart: null,
          dragCurrent: null,
          move: { ...EMPTY_MOVE },
        };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);


  // ── Pointer handlers ──────────────────────────────────────────────────────

  const handleSelectionPointerDown = useCallback(
    (docX: number, docY: number) => {
      if (tool !== "rect" && tool !== "lasso") return;

      setSelState((prev) => {
        // Jika sedang dalam mode move, mulai drag
        if (prev.move.active) {
          return {
            ...prev,
            move: {
              ...prev.move,
              dragging: true,
              dragStartDocX: docX,
              dragStartDocY: docY,
              dragOriginX: prev.move.currentX,
              dragOriginY: prev.move.currentY,
            },
          };
        }

        // Klik baru memulai selection → clear selection lama
        return {
          active: false,
          drawing: true,
          selection: null,
          lassoPoints: tool === "lasso" ? [{ x: docX, y: docY }] : [],
          dragStart: { x: docX, y: docY },
          dragCurrent: { x: docX, y: docY },
          move: { ...EMPTY_MOVE },
        };
      });
    },
    [tool],
  );

  const handleSelectionPointerMove = useCallback(
    (docX: number, docY: number) => {
      if (tool !== "rect" && tool !== "lasso") return;

      setSelState((prev) => {
        // Jika sedang drag move
        if (prev.move.active && prev.move.dragging) {
          const dx = docX - prev.move.dragStartDocX;
          const dy = docY - prev.move.dragStartDocY;
          return {
            ...prev,
            move: {
              ...prev.move,
              currentX: prev.move.dragOriginX + dx,
              currentY: prev.move.dragOriginY + dy,
            },
          };
        }

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
        // Jika sedang drag move, selesaikan drag
        if (prev.move.active && prev.move.dragging) {
          const dx = docX - prev.move.dragStartDocX;
          const dy = docY - prev.move.dragStartDocY;
          return {
            ...prev,
            move: {
              ...prev.move,
              dragging: false,
              currentX: prev.move.dragOriginX + dx,
              currentY: prev.move.dragOriginY + dy,
            },
          };
        }

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
              move: { ...EMPTY_MOVE },
            };
          }

          return {
            active: true,
            drawing: false,
            selection: { mode: "rect", x, y, w, h },
            lassoPoints: [],
            dragStart: null,
            dragCurrent: { x: docX, y: docY },
            move: { ...EMPTY_MOVE },
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
              move: { ...EMPTY_MOVE },
            };
          }

          return {
            active: true,
            drawing: false,
            selection: { mode: "lasso", points: pts },
            lassoPoints: pts,
            dragStart: null,
            dragCurrent: { x: docX, y: docY },
            move: { ...EMPTY_MOVE },
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

  // ── Internal: commit move (gambar floating canvas ke layer) ────────────────
  function commitMoveInternal(state: SelectionState) {
    if (!state.move.active || !state.move.floatingCanvas) return;
    
    const store = getActiveStore();
    if (!store || !activeLayerId) return;
    
    const layerCanvas = store.layerCanvases.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!ctx || !layerCanvas) return;
    
    // Gambar floating canvas ke posisi baru
    ctx.drawImage(
      state.move.floatingCanvas,
      Math.round(state.move.currentX),
      Math.round(state.move.currentY),
    );
    
    recomposite();
    persistActiveLayerContent();
  }

  // ── Operasi ─────────────────────────────────────────────────────────────────

  const clearSelection = useCallback(() => {
    setSelState((prev) => {
      // Jika sedang move, commit dulu
      if (prev.move.active && prev.move.floatingCanvas) {
        commitMoveInternal(prev);
      }
      return {
        active: false,
        drawing: false,
        selection: null,
        lassoPoints: [],
        dragStart: null,
        dragCurrent: null,
        move: { ...EMPTY_MOVE },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getActiveStore, activeLayerId, recomposite, persistActiveLayerContent]);

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

  // ── Move Selection ────────────────────────────────────────────────────────
  const startMoveSelection = useCallback(() => {
    const store = getActiveStore();
    if (!store || !activeLayerId || !selState.selection) return;

    const activeLayerMeta = layers.find((l) => l.id === activeLayerId);
    if (activeLayerMeta?.locked || !activeLayerMeta?.visible) return;

    const layerCanvas = store.layerCanvases.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!ctx || !layerCanvas) return;

    pushHistory();

    let floatingCanvas: HTMLCanvasElement;
    let originX: number;
    let originY: number;

    if (selState.selection.mode === "rect") {
      const { x, y, w, h } = selState.selection;
      originX = Math.round(x);
      originY = Math.round(y);
      const fw = Math.max(1, Math.round(w));
      const fh = Math.max(1, Math.round(h));

      floatingCanvas = document.createElement("canvas");
      floatingCanvas.width = fw;
      floatingCanvas.height = fh;
      const fCtx = floatingCanvas.getContext("2d");
      if (!fCtx) return;

      // Ambil piksel dari layer aktif saja
      fCtx.drawImage(layerCanvas, originX, originY, fw, fh, 0, 0, fw, fh);

      // Hapus area asli dari layer
      ctx.clearRect(originX, originY, fw, fh);
    } else {
      // Lasso
      const { points } = selState.selection;
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      const minX = Math.floor(Math.min(...xs));
      const minY = Math.floor(Math.min(...ys));
      const maxX = Math.ceil(Math.max(...xs));
      const maxY = Math.ceil(Math.max(...ys));
      const fw = Math.max(1, maxX - minX);
      const fh = Math.max(1, maxY - minY);
      originX = minX;
      originY = minY;

      floatingCanvas = document.createElement("canvas");
      floatingCanvas.width = fw;
      floatingCanvas.height = fh;
      const fCtx = floatingCanvas.getContext("2d");
      if (!fCtx) return;

      // Clip lasso path, lalu ambil piksel
      fCtx.save();
      fCtx.translate(-minX, -minY);
      applyLassoClip(fCtx, points);
      fCtx.drawImage(layerCanvas, 0, 0);
      fCtx.restore();

      // Hapus area asli dari layer
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fill();
      ctx.restore();
    }

    recomposite();

    setSelState((prev) => ({
      ...prev,
      move: {
        active: true,
        floatingCanvas,
        originX,
        originY,
        currentX: originX,
        currentY: originY,
        dragging: false,
        dragStartDocX: 0,
        dragStartDocY: 0,
        dragOriginX: originX,
        dragOriginY: originY,
      },
    }));
  }, [
    getActiveStore,
    activeLayerId,
    layers,
    selState.selection,
    pushHistory,
    recomposite,
  ]);

  /** Commit move: stamp floating canvas ke layer dan tutup mode move */
  const commitMove = useCallback(() => {
    setSelState((prev) => {
      if (!prev.move.active || !prev.move.floatingCanvas) return prev;

      const store = getActiveStore();
      if (!store || !activeLayerId) return prev;

      const layerCanvas = store.layerCanvases.get(activeLayerId);
      const ctx = layerCanvas?.getContext("2d");
      if (!ctx || !layerCanvas) return prev;

      ctx.drawImage(
        prev.move.floatingCanvas,
        Math.round(prev.move.currentX),
        Math.round(prev.move.currentY),
      );

      recomposite();
      persistActiveLayerContent();

      return {
        active: false,
        drawing: false,
        selection: null,
        lassoPoints: [],
        dragStart: null,
        dragCurrent: null,
        move: { ...EMPTY_MOVE },
      };
    });
  }, [getActiveStore, activeLayerId, recomposite, persistActiveLayerContent]);

  // Keyboard shortcut: Escape → clear selection / cancel move, Enter → commit move
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selState.move.active) {
          // Cancel move: revert floating ke posisi asli lalu commit
          setSelState((prev) => {
            if (!prev.move.active || !prev.move.floatingCanvas) return prev;

            const store = getActiveStore();
            if (!store || !activeLayerId) return prev;

            const layerCanvas = store.layerCanvases.get(activeLayerId);
            const ctx = layerCanvas?.getContext("2d");
            if (!ctx) return prev;

            // Letakkan kembali ke posisi asli
            ctx.drawImage(
              prev.move.floatingCanvas,
              Math.round(prev.move.originX),
              Math.round(prev.move.originY),
            );

            recomposite();
            persistActiveLayerContent();

            return {
              active: false,
              drawing: false,
              selection: null,
              lassoPoints: [],
              dragStart: null,
              dragCurrent: null,
              move: { ...EMPTY_MOVE },
            };
          });
        } else if (selState.active) {
          clearSelection();
        }
      } else if (e.key === "Enter" && selState.move.active) {
        commitMove();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selState.active, selState.move.active, clearSelection, commitMove]);

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
    startMoveSelection,
    commitMove,
  };
}
