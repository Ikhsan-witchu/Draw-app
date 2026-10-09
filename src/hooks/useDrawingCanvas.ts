// ─── Hook utama: orchestrator kanvas drawing ──────────────────────────────────

import { useRef, useState, useEffect, useCallback, type DragEvent as ReactDragEvent } from "react";
import type { LayerMeta, TabStore, UseDrawingCanvasOptions } from "../types/drawing";
import { saveProject as saveProjectFile, loadProject as loadProjectFile } from "../utils/projectFile";
import {
  hslStringToRgb,
  rgbToHsl,
  floodFill,
  createLayerCanvas,
  generateId,
  loadImageFromFile,
} from "../utils/canvasUtils";
import { dispatchBrush } from "../utils/brushUtils";
import {
  drawShapeLine,
  drawShapeRect,
  drawShapeEllipse,
  drawShapeGradient,
} from "../utils/shapeUtils";
import {
  saveLayerCanvasBlob,
  loadLayerCanvasBlob,
  applyBlobToCanvas,
  deleteLayerBlob,
  createThumbnailDataUrl,
  saveActiveAppState,
  loadActiveAppState,
  saveRecentProject,
  loadRecentProject,
  type PersistedTabMeta,
} from "../utils/persistence";
import { useLayerManager } from "./useLayerManager";
import { useCanvasGestures } from "./useCanvasGestures";
import { useTextTool } from "./useTextTool";
import { useSelectionTool } from "./useSelectionTool";
import { useAnimationTimeline } from "./useAnimationTimeline";
import { useCompositor } from "./useCompositor";
import { useHistory } from "./useHistory";

// Re-export tipe yang dibutuhkan konsumen luar
export type { LayerMeta, DocumentTab } from "../types/drawing";

export function useDrawingCanvas({
  tool,
  brushType = "pen",
  brushSize = 8,
  brushOpacity = 100,
  stabilizerStrength = 3,
  shapeFilled = false,
  color,
  tabs,
  activeTabId,
  onColorPick,
}: UseDrawingCanvasOptions) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const tabStoresRef = useRef<Map<string, TabStore>>(new Map());
  const justInitializedRef = useRef<Set<string>>(new Set());
  // Tab IDs yang perlu di-fit ke viewport setelah render pertama (viewport belum siap saat init)
  const needsFitRef = useRef<Set<string>>(new Set());
  const prevActiveTabIdRef = useRef<string | null>(null);

  const [layers, setLayers] = useState<LayerMeta[]>(() => {
    const saved = loadActiveAppState() || (loadRecentProject()?.tab ? { tabs: [loadRecentProject()!.tab] } : null);
    const tab = saved?.tabs?.find((t) => t.id === activeTabId) ?? saved?.tabs?.[0];
    if (tab?.layers && Array.isArray(tab.layers) && tab.layers.length > 0) {
      return tab.layers;
    }
    return [];
  });
  const [activeLayerId, setActiveLayerId] = useState<string | null>(() => {
    const saved = loadActiveAppState() || (loadRecentProject()?.tab ? { tabs: [loadRecentProject()!.tab] } : null);
    const tab = saved?.tabs?.find((t) => t.id === activeTabId) ?? saved?.tabs?.[0];
    return tab?.activeLayerId ?? tab?.layers?.[0]?.id ?? null;
  });

  // ── Transform state ────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(() => {
    const saved = loadActiveAppState() || (loadRecentProject()?.tab ? { tabs: [loadRecentProject()!.tab] } : null);
    const tab = saved?.tabs?.find((t) => t.id === activeTabId) ?? saved?.tabs?.[0];
    return tab?.zoom ?? 1;
  });
  const [panX, setPanX] = useState(() => {
    const saved = loadActiveAppState() || (loadRecentProject()?.tab ? { tabs: [loadRecentProject()!.tab] } : null);
    const tab = saved?.tabs?.find((t) => t.id === activeTabId) ?? saved?.tabs?.[0];
    return tab?.panX ?? 0;
  });
  const [panY, setPanY] = useState(() => {
    const saved = loadActiveAppState() || (loadRecentProject()?.tab ? { tabs: [loadRecentProject()!.tab] } : null);
    const tab = saved?.tabs?.find((t) => t.id === activeTabId) ?? saved?.tabs?.[0];
    return tab?.panY ?? 0;
  });
  const [rotation, setRotation] = useState(() => {
    const saved = loadActiveAppState() || (loadRecentProject()?.tab ? { tabs: [loadRecentProject()!.tab] } : null);
    const tab = saved?.tabs?.find((t) => t.id === activeTabId) ?? saved?.tabs?.[0];
    return tab?.rotation ?? 0;
  });

  // Refs untuk akses langsung dari event handler tanpa stale closure
  const zoomRef = useRef(zoom);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  const rotationRef = useRef(rotation);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panXRef.current = panX; }, [panX]);
  useEffect(() => { panYRef.current = panY; }, [panY]);
  useEffect(() => { rotationRef.current = rotation; }, [rotation]);

  // Scratch canvas: goresan sedang berjalan digambar di sini (opacity penuh),
  // lalu di-composite ke display canvas dengan brush opacity.
  // Ini mencegah penumpukan opacity dalam satu goresan.
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scratchOpacityRef = useRef(1);

  // Buffer reusable untuk compositing kliping mask
  const groupCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const clipBufferRef = useRef<HTMLCanvasElement | null>(null);
  const baseMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scratchPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  function getReusableCanvas(
    ref: { current: HTMLCanvasElement | null },
    w: number,
    h: number,
  ): HTMLCanvasElement {
    if (!ref.current || ref.current.width !== w || ref.current.height !== h) {
      ref.current = createLayerCanvas(w, h);
    }
    return ref.current;
  }


  // ── Helper: ambil store tab aktif ─────────────────────────────────────────
  function getActiveStore(): TabStore | undefined {
    return activeTabId ? tabStoresRef.current.get(activeTabId) : undefined;
  }

  // ── Hitung zoom fit-to-viewport ───────────────────────────────────────────
  function calculateFit(tabWidth: number, tabHeight: number) {
    const viewport = viewportRef.current;
    if (!viewport) return { zoom: 1, panX: 0, panY: 0, rotation: 0 };

    const { width: vw, height: vh } = viewport.getBoundingClientRect();
    if (vw <= 0 || vh <= 0 || !tabWidth || !tabHeight) {
      return { zoom: 1, panX: 0, panY: 0, rotation: 0 };
    }

    const scaleX = vw / tabWidth;
    const scaleY = vh / tabHeight;
    // Skala fit tepat menyentuh batas kiri-kanan (jika melebar) atau atas-bawah (jika meninggi)
    const fitZoom = Math.min(scaleX, scaleY);

    return { zoom: fitZoom > 0 ? fitZoom : 1, panX: 0, panY: 0, rotation: 0 };
  }

  // ── Inisialisasi & sinkronisasi tab store ─────────────────────────────────
  useEffect(() => {
    // Ambil data yang tersimpan di storage (jika browser baru di-reload)
    const persistedState = loadActiveAppState() || (loadRecentProject()?.tab ? { tabs: [loadRecentProject()!.tab] } : null);

    // Buat store untuk tab baru atau pulihkan dari storage
    for (const tab of tabs) {
      if (tabStoresRef.current.has(tab.id)) continue;

      const persistedTab = persistedState?.tabs?.find((t) => t.id === tab.id);

      if (persistedTab && Array.isArray(persistedTab.layers) && persistedTab.layers.length > 0) {
        // Pulihkan dari state tersimpan: tidak membuat duplicate layer
        const layerCanvasesMap = new Map<string, HTMLCanvasElement>();
        for (const l of persistedTab.layers) {
          layerCanvasesMap.set(l.id, createLayerCanvas(tab.width, tab.height));
        }

        tabStoresRef.current.set(tab.id, {
          width: tab.width,
          height: tab.height,
          layers: persistedTab.layers,
          activeLayerId: persistedTab.activeLayerId ?? persistedTab.layers[0]?.id ?? null,
          layerCanvases: layerCanvasesMap,
          history: new Map(),
          zoom: persistedTab.zoom ?? 1,
          panX: persistedTab.panX ?? 0,
          panY: persistedTab.panY ?? 0,
          rotation: persistedTab.rotation ?? 0,
        });

        // Jika tab dipulihkan tanpa zoom tersimpan, fit ke viewport nanti
        if (persistedTab.zoom == null) {
          needsFitRef.current.add(tab.id);
        }

        // Muat piksel layer dari IndexedDB secara asinkron
        (async () => {
          let hasLoadedAny = false;
          for (const l of persistedTab.layers) {
            const lc = layerCanvasesMap.get(l.id);
            if (lc) {
              const blob = await loadLayerCanvasBlob(tab.id, l.id);
              if (blob) {
                await applyBlobToCanvas(lc, blob);
                hasLoadedAny = true;
                if (activeTabId === tab.id || !activeTabId) {
                  recompositeRef.current();
                }
              }
            }
          }
          if (hasLoadedAny && (activeTabId === tab.id || !activeTabId)) {
            recompositeRef.current();
            setLayers((prev) => [...prev]);
          }
        })();
      } else {
        // Tab baru biasa
        const backgroundId = generateId("layer");
        const layerOneId = generateId("layer");

        const backgroundCanvas = createLayerCanvas(tab.width, tab.height);
        const bgCtx = backgroundCanvas.getContext("2d");
        if (tab.initialImage) {
          bgCtx?.drawImage(tab.initialImage, 0, 0, tab.width, tab.height);
        } else if (bgCtx) {
          bgCtx.fillStyle = "#ffffff";
          bgCtx.fillRect(0, 0, tab.width, tab.height);
        }

        const fit = calculateFit(tab.width, tab.height);
        const hasViewport = Boolean(viewportRef.current && viewportRef.current.clientWidth > 0);

        tabStoresRef.current.set(tab.id, {
          width: tab.width,
          height: tab.height,
          layers: [
            { id: layerOneId, name: "Layer 1", visible: true, locked: false },
            { id: backgroundId, name: "Background", visible: true, locked: false },
          ],
          activeLayerId: layerOneId,
          layerCanvases: new Map([
            [layerOneId, createLayerCanvas(tab.width, tab.height)],
            [backgroundId, backgroundCanvas],
          ]),
          history: new Map(),
          zoom: hasViewport ? fit.zoom : 1,
          panX: 0,
          panY: 0,
          rotation: 0,
        });

        // Tab baru selalu di-fit ke viewport agar pas menyentuh batas sidebar / bar
        needsFitRef.current.add(tab.id);

        saveLayerCanvasBlob(tab.id, backgroundId, backgroundCanvas);
      }

      justInitializedRef.current.add(tab.id);
    }

    // Hapus store untuk tab yang sudah ditutup
    for (const key of Array.from(tabStoresRef.current.keys())) {
      if (!tabs.some((t) => t.id === key)) {
        tabStoresRef.current.delete(key);
      }
    }

    // Simpan state tab sebelumnya sebelum pindah tab
    const prevId = prevActiveTabIdRef.current;
    if (prevId && prevId !== activeTabId) {
      const prevStore = tabStoresRef.current.get(prevId);
      if (prevStore) {
        prevStore.layers = layers;
        prevStore.activeLayerId = activeLayerId;
        prevStore.zoom = zoomRef.current;
        prevStore.panX = panXRef.current;
        prevStore.panY = panYRef.current;
        prevStore.rotation = rotationRef.current;
      }
    }

    // Muat state tab yang baru aktif ke React state
    const store = getActiveStore();
    const canvas = canvasRef.current;
    if (store && canvas) {
      canvas.width = store.width;
      canvas.height = store.height;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctxRef.current = ctx;
      }

      setLayers(store.layers);
      setActiveLayerId(store.activeLayerId);
      setZoom(store.zoom);
      setPanX(store.panX);
      setPanY(store.panY);
      setRotation(store.rotation);
      recomposite();
    }

    prevActiveTabIdRef.current = activeTabId;
    schedulePersistSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, activeTabId]);

  // ── Deferred fit-to-viewport via ResizeObserver ────────────────────────────
  // RAF tidak cukup andal karena viewportRef bisa jadi belum mounted saat effect jalan.
  // ResizeObserver fire tepat saat viewport punya ukuran nyata.
  useEffect(() => {
    if (!activeTabId) return;
    if (!needsFitRef.current.has(activeTabId)) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    // Coba langsung dulu — viewport mungkin sudah punya ukuran
    const tryFit = () => {
      const store = tabStoresRef.current.get(activeTabId);
      if (!store) return false;
      const { width: vw, height: vh } = viewport.getBoundingClientRect();
      if (vw === 0 || vh === 0) return false; // belum siap

      const scaleX = vw / store.width;
      const scaleY = vh / store.height;
      // Fit tepat menyentuh batas kiri-kanan (jika melebar) atau atas-bawah (jika meninggi)
      const fitZoom = Math.min(scaleX, scaleY);
      const safeZoom = fitZoom > 0 ? fitZoom : 1;

      store.zoom = safeZoom;
      store.panX = 0;
      store.panY = 0;
      store.rotation = 0;

      setZoom(safeZoom);
      setPanX(0);
      setPanY(0);
      setRotation(0);

      needsFitRef.current.delete(activeTabId);
      return true;
    };

    if (tryFit()) return; // sudah berhasil, selesai

    // Viewport belum siap → pantau dengan ResizeObserver
    const ro = new ResizeObserver(() => {
      if (tryFit()) ro.disconnect();
    });
    ro.observe(viewport);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, tabs]);

  const { recomposite, recompositeRect } = useCompositor({
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
  });

  const recompositeRef = useRef(recomposite);
  recompositeRef.current = recomposite;

  useEffect(() => {
    recomposite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, activeTabId]);

  // ── Persistensi State & Layer Canvases ────────────────────────────────────
  function persistCurrentSession() {
    if (!tabs || tabs.length === 0) return;

    const persistedTabs: PersistedTabMeta[] = tabs.map((t) => {
      const s = tabStoresRef.current.get(t.id);
      return {
        id: t.id,
        title: t.title,
        width: t.width,
        height: t.height,
        layers: s?.layers ?? [
          { id: "layer-1", name: "Layer 1", visible: true, locked: false },
          { id: "layer-bg", name: "Background", visible: true, locked: false },
        ],
        activeLayerId: s?.activeLayerId ?? null,
        zoom: s?.zoom ?? 1,
        panX: s?.panX ?? 0,
        panY: s?.panY ?? 0,
        rotation: s?.rotation ?? 0,
      };
    });

    const current = loadActiveAppState();
    saveActiveAppState({
      ...current,
      activeTabId,
      tabs: persistedTabs,
      activeTool: tool,
      activeBrush: brushType,
      brushSize,
    });

    // Simpan snapshot juga ke recent project untuk Home screen
    const activeStore = getActiveStore();
    const activeTab = tabs.find((t) => t.id === activeTabId);
    const mainCanvas = canvasRef.current;
    if (activeTab && activeStore && mainCanvas) {
      const thumbUrl = createThumbnailDataUrl(mainCanvas);
      saveRecentProject({
        tab: {
          id: activeTab.id,
          title: activeTab.title,
          width: activeTab.width,
          height: activeTab.height,
          layers: activeStore.layers,
          activeLayerId: activeStore.activeLayerId,
          zoom: activeStore.zoom,
          panX: activeStore.panX,
          panY: activeStore.panY,
          rotation: activeStore.rotation,
        },
        thumbnailDataUrl: thumbUrl,
        updatedAt: Date.now(),
        layerCount: activeStore.layers.length,
      });
    }
  }

  const debouncedPersistRef = useRef<number | null>(null);
  function schedulePersistSession() {
    if (debouncedPersistRef.current) {
      window.clearTimeout(debouncedPersistRef.current);
    }
    debouncedPersistRef.current = window.setTimeout(() => {
      persistCurrentSession();
    }, 350);
  }

  function persistActiveLayerContent() {
    const store = getActiveStore();
    if (!activeTabId || !activeLayerId || !store) return;
    const layerCanvas = store.layerCanvases.get(activeLayerId);
    if (!layerCanvas) return;

    saveLayerCanvasBlob(activeTabId, activeLayerId, layerCanvas).then(() => {
      persistCurrentSession();
    });
  }

  /** Flatten scratch canvas ke layer asli saat stroke selesai (pointer up). */
  function commitScratchCanvas() {
    const scratch = scratchCanvasRef.current;
    if (!scratch) return;

    const store = getActiveStore();
    if (!store || !activeLayerId) {
      scratchCanvasRef.current = null;
      return;
    }

    const activeMeta = layers.find((l) => l.id === activeLayerId);
    const layerCanvas = store.layerCanvases.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    if (ctx && layerCanvas) {
      ctx.save();
      ctx.globalAlpha = scratchOpacityRef.current;
      ctx.globalCompositeOperation = activeMeta?.alphaLocked ? "source-atop" : "source-over";
      ctx.drawImage(scratch, 0, 0);
      ctx.restore();
    }

    scratchCanvasRef.current = null;
    recomposite();
  }

  // Sync layer state ke store (skip tab yang baru diinisialisasi)
  useEffect(() => {
    if (activeTabId && justInitializedRef.current.has(activeTabId)) {
      justInitializedRef.current.delete(activeTabId);
      return;
    }
    const store = getActiveStore();
    if (store) {
      store.layers = layers;
      store.activeLayerId = activeLayerId;
      schedulePersistSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, activeLayerId]);

  // Sync transform ke store
  useEffect(() => {
    const store = getActiveStore();
    if (store) {
      store.zoom = zoom;
      store.panX = panX;
      store.panY = panY;
      store.rotation = rotation;
      schedulePersistSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, panX, panY, rotation]);

  // ── Transformasi koordinat: layar → dokumen ───────────────────────────────
  function docPointFromClient(clientX: number, clientY: number): { x: number; y: number } {
    const viewport = viewportRef.current;
    const store = getActiveStore();
    if (!viewport || !store) return { x: 0, y: 0 };

    const vRect = viewport.getBoundingClientRect();
    const viewCenterX = vRect.left + vRect.width / 2;
    const viewCenterY = vRect.top + vRect.height / 2;

    const canvasCenterX = viewCenterX + panXRef.current;
    const canvasCenterY = viewCenterY + panYRef.current;

    const vx = clientX - canvasCenterX;
    const vy = clientY - canvasCenterY;

    const rad = (rotationRef.current * Math.PI) / 180;
    const rotX = vx * Math.cos(-rad) - vy * Math.sin(-rad);
    const rotY = vx * Math.sin(-rad) + vy * Math.cos(-rad);

    return {
      x: rotX / zoomRef.current + store.width / 2,
      y: rotY / zoomRef.current + store.height / 2,
    };
  }

  // ── History & Undo/Redo ───────────────────────────────────────────────────
  const { canUndo, canRedo, pushHistory, handleUndo, handleRedo } = useHistory({
    activeTabId,
    activeLayerId,
    getActiveStore,
    scratchCanvasRef,
    recomposite,
    persistActiveLayerContent,
  });


  // ── Tool actions ──────────────────────────────────────────────────────────
  function handleBucketFill(clientX: number, clientY: number) {
    const store = getActiveStore();
    if (!store || !activeLayerId) return;

    const activeLayerMeta = layers.find((l) => l.id === activeLayerId);
    if (activeLayerMeta?.locked || !activeLayerMeta?.visible) return;

    const layerCanvas = store.layerCanvases.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!ctx || !layerCanvas) return;

    const point = docPointFromClient(clientX, clientY);
    const px = Math.floor(point.x);
    const py = Math.floor(point.y);
    if (px < 0 || py < 0 || px >= layerCanvas.width || py >= layerCanvas.height) return;

    pushHistory();

    const imageData = ctx.getImageData(0, 0, layerCanvas.width, layerCanvas.height);
    let r = 0, g = 0, b = 0;
    if (color.startsWith("rgb")) {
      const match = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
      if (match) {
        r = parseInt(match[1], 10);
        g = parseInt(match[2], 10);
        b = parseInt(match[3], 10);
      }
    } else {
      [r, g, b] = hslStringToRgb(color);
    }
    floodFill(imageData, px, py, [r, g, b, 255], 24);
    ctx.putImageData(imageData, 0, 0);
    recomposite();
    persistActiveLayerContent();
  }

  function handleEyedropperPick(clientX: number, clientY: number) {
    const ctx = ctxRef.current;
    const store = getActiveStore();
    if (!ctx || !store) return;

    const point = docPointFromClient(clientX, clientY);
    const px = Math.floor(point.x);
    const py = Math.floor(point.y);
    if (px < 0 || py < 0 || px >= store.width || py >= store.height) return;

    const pixel = ctx.getImageData(px, py, 1, 1).data;
    onColorPick?.(rgbToHsl(pixel[0], pixel[1], pixel[2]));
  }

  // ── Filters ────────────────────────────────────────────────────────────────
  // 🎨 Outline Tool
  function applyOutlineToActiveLayer(outlineColor: string, thickness: number) {
    const store = getActiveStore();
    if (!store || !activeLayerId) return;
    
    const activeLayerMeta = layers.find((l) => l.id === activeLayerId);
    if (activeLayerMeta?.locked || !activeLayerMeta?.visible) return;

    const layerCanvas = store.layerCanvases.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!ctx || !layerCanvas) return;

    pushHistory();

    const w = layerCanvas.width;
    const h = layerCanvas.height;

    const silhouetteCanvas = document.createElement("canvas");
    silhouetteCanvas.width = w;
    silhouetteCanvas.height = h;
    const silCtx = silhouetteCanvas.getContext("2d");
    if (!silCtx) return;

    silCtx.drawImage(layerCanvas, 0, 0);
    silCtx.globalCompositeOperation = "source-in";
    silCtx.fillStyle = outlineColor;
    silCtx.fillRect(0, 0, w, h);

    const outCanvas = document.createElement("canvas");
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext("2d");
    if (!outCtx) return;

    const maxRadius = Math.min(50, Math.ceil(thickness));
    const radSq = maxRadius * maxRadius;

    for (let x = -maxRadius; x <= maxRadius; x++) {
      for (let y = -maxRadius; y <= maxRadius; y++) {
        if (x * x + y * y <= radSq) {
          outCtx.drawImage(silhouetteCanvas, x, y);
        }
      }
    }

    outCtx.drawImage(layerCanvas, 0, 0);

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(outCanvas, 0, 0);

    recomposite();
    persistActiveLayerContent();
  }

  function applyFilterToActiveLayer(filterStr: string) {
    const store = getActiveStore();
    if (!store || !activeLayerId) return;
    
    const activeLayerMeta = layers.find((l) => l.id === activeLayerId);
    if (activeLayerMeta?.locked || !activeLayerMeta?.visible) return;

    const layerCanvas = store.layerCanvases.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!ctx || !layerCanvas) return;

    pushHistory();

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = layerCanvas.width;
    tempCanvas.height = layerCanvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    tempCtx.drawImage(layerCanvas, 0, 0);

    ctx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
    ctx.filter = filterStr;
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.filter = "none"; // reset

    recomposite();
    persistActiveLayerContent();
  }

  // ── Drawing stroke ─────────────────────────────────────────────────────────
  function drawStrokeSegment(
    from: { x: number; y: number; pressure: number },
    to: { x: number; y: number; pressure: number },
  ) {
    const store = getActiveStore();
    if (!store || !activeLayerId) return;

    const layerCanvas = store.layerCanvases.get(activeLayerId);
    if (!layerCanvas) return;

    const isEraser = tool === "eraser";
    const opacityFactor = (brushOpacity ?? 100) / 100;
    const currentSize = Math.max(1, brushSize);

    if (isEraser) {
      // Eraser langsung ke layer canvas (destination-out tidak bisa via scratch)
      const ctx = layerCanvas.getContext("2d");
      if (!ctx) return;
      dispatchBrush(brushType, ctx, from, to, currentSize, color, true, opacityFactor);
    } else {
      // Buat scratch canvas jika belum ada (per-stroke)
      if (!scratchCanvasRef.current) {
        scratchCanvasRef.current = createLayerCanvas(layerCanvas.width, layerCanvas.height);
        scratchOpacityRef.current = opacityFactor;
      }
      const scratchCtx = scratchCanvasRef.current.getContext("2d");
      if (!scratchCtx) return;
      // Gambar dengan opacity penuh di scratch — opacity diterapkan saat recomposite
      dispatchBrush(brushType, scratchCtx, from, to, currentSize, color, false, 1);
    }

    // Dirty-rect invalidation: rekomposisi hanya sub-area kecil yang disentuh kuas
    const pad = Math.max(Math.ceil(currentSize * 1.8) + 8, 24);
    const minX = Math.min(from.x, to.x) - pad;
    const minY = Math.min(from.y, to.y) - pad;
    const maxX = Math.max(from.x, to.x) + pad;
    const maxY = Math.max(from.y, to.y) + pad;
    recompositeRect(minX, minY, maxX - minX, maxY - minY);
  }

  const isShapeTool = ["line", "rectShape", "ellipseShape", "gradient"].includes(tool);
  const isDrawable = tool === "brush" || tool === "eraser" || isShapeTool;

  function renderShapeToContext(
    targetCtx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    width: number,
    height: number,
  ) {
    const opacityFactor = (brushOpacity ?? 100) / 100;
    const currentSize = Math.max(1, brushSize);

    if (tool === "line") {
      drawShapeLine(targetCtx, from, to, currentSize, color, opacityFactor);
    } else if (tool === "rectShape") {
      drawShapeRect(targetCtx, from, to, currentSize, color, shapeFilled ?? false, opacityFactor);
    } else if (tool === "ellipseShape") {
      drawShapeEllipse(targetCtx, from, to, currentSize, color, shapeFilled ?? false, opacityFactor);
    } else if (tool === "gradient") {
      drawShapeGradient(targetCtx, from, to, width, height, color, false, opacityFactor);
    }
  }

  const shapeRafRef = useRef<number | null>(null);
  const pendingShapePreviewRef = useRef<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);

  function handleShapePreview(from: { x: number; y: number }, to: { x: number; y: number }) {
    pendingShapePreviewRef.current = { from, to };
    if (shapeRafRef.current == null) {
      shapeRafRef.current = requestAnimationFrame(() => {
        shapeRafRef.current = null;
        const pending = pendingShapePreviewRef.current;
        if (!pending) return;
        const store = getActiveStore();
        const ctx = ctxRef.current;
        if (!store || !ctx) return;

        recomposite();
        renderShapeToContext(ctx, pending.from, pending.to, store.width, store.height);
      });
    }
  }

  function handleShapeCommit(from: { x: number; y: number }, to: { x: number; y: number }) {
    if (shapeRafRef.current != null) {
      cancelAnimationFrame(shapeRafRef.current);
      shapeRafRef.current = null;
    }
    pendingShapePreviewRef.current = null;

    const store = getActiveStore();
    if (!store || !activeLayerId) return;

    const layerCanvas = store.layerCanvases.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!ctx) return;

    renderShapeToContext(ctx, from, to, store.width, store.height);
    recomposite();
    persistActiveLayerContent();
  }

  // ── Layer manager ─────────────────────────────────────────────────────────
  const layerManager = useLayerManager({
    getActiveStore,
    layers,
    setLayers,
    activeLayerId,
    setActiveLayerId,
    recomposite,
    onLayerStructureChange: (deletedId, addedOrUpdatedId) => {
      if (deletedId && activeTabId) {
        deleteLayerBlob(activeTabId, deletedId);
      }
      if (addedOrUpdatedId && activeTabId) {
        const store = getActiveStore();
        const canvas = store?.layerCanvases.get(addedOrUpdatedId);
        if (canvas) {
          saveLayerCanvasBlob(activeTabId, addedOrUpdatedId, canvas);
        }
      }
      persistCurrentSession();
    },
  });

  // ── Text Tool ─────────────────────────────────────────────────────────────
  const textTool = useTextTool({
    tool,
    color,
    brushSize: brushSize ?? 8,
    getActiveStore,
    activeLayerId,
    layers,
    pushHistory,
    recomposite,
    persistActiveLayerContent,
  });

  // ── Selection Tools (Rect & Lasso) ────────────────────────────────────────
  const selectionTool = useSelectionTool({
    tool,
    color,
    getActiveStore,
    activeLayerId,
    layers,
    pushHistory,
    recomposite,
    persistActiveLayerContent,
  });

  // ── Animation Timeline ───────────────────────────────────────────────────
  const activeCanvasWidth = getActiveStore()?.width ?? tabs.find((t) => t.id === activeTabId)?.width ?? 1080;
  const activeCanvasHeight = getActiveStore()?.height ?? tabs.find((t) => t.id === activeTabId)?.height ?? 1080;

  const timeline = useAnimationTimeline({
    getActiveStore,
    recomposite,
    activeTabId,
    layers,
    canvasWidth: activeCanvasWidth,
    canvasHeight: activeCanvasHeight,
  });

  const gestures = useCanvasGestures({
    viewportRef,
    tool,
    zoomRef,
    panXRef,
    panYRef,
    rotationRef,
    setZoom,
    setPanX,
    setPanY,
    setRotation,
    getActiveStore,
    layers,
    activeLayerId,
    isDrawable,
    isShapeTool,
    stabilizerStrength,
    docPointFromClient,
    pushHistory,
    drawStrokeSegment,
    handleBucketFill,
    handleEyedropperPick,
    onShapePreview: handleShapePreview,
    onShapeCommit: handleShapeCommit,
    recomposite,
    onStrokeComplete: () => {
      commitScratchCanvas();
      persistActiveLayerContent();
    },
    clearScratch: () => {
      scratchCanvasRef.current = null;
    },
    onTextClick: textTool.startTextEdit,
    onSelectionPointerDown: selectionTool.handleSelectionPointerDown,
    onSelectionPointerMove: selectionTool.handleSelectionPointerMove,
    onSelectionPointerUp: selectionTool.handleSelectionPointerUp,
  });

  // Pause animasi saat user berinteraksi / menggambar di kanvas
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (timeline.isPlaying) {
        timeline.pause();
      }
      gestures.handlePointerDown(e);
    },
    [timeline, gestures]
  );


  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.ctrlKey || e.metaKey;
      const isInputField =
        (e.target as HTMLElement)?.tagName === "INPUT" ||
        (e.target as HTMLElement)?.tagName === "TEXTAREA" ||
        (e.target as HTMLElement)?.tagName === "SELECT";

      if (isMod && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }
      if ((isMod && e.shiftKey && e.key.toLowerCase() === "z") || (isMod && e.key.toLowerCase() === "y")) {
        e.preventDefault();
        handleRedo();
        return;
      }
      // Ctrl+S ditangani oleh DrawingWorkspace (SaveDialog)

      // ── Shortcut Animasi (hanya saat bukan di form input) ──
      if (!isInputField) {
        // Space: Play/Pause
        if (e.key === " " || e.code === "Space") {
          e.preventDefault();
          timeline.togglePlay();
          return;
        }
        // ArrowRight: Frame berikutnya
        if (e.key === "ArrowRight" && !isMod) {
          e.preventDefault();
          timeline.nextFrame();
          return;
        }
        // ArrowLeft: Frame sebelumnya
        if (e.key === "ArrowLeft" && !isMod) {
          e.preventDefault();
          timeline.prevFrame();
          return;
        }
        // Home: Frame pertama
        if (e.key === "Home") {
          e.preventDefault();
          timeline.firstFrame();
          return;
        }
        // End: Frame terakhir
        if (e.key === "End") {
          e.preventDefault();
          timeline.lastFrame();
          return;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayerId, activeTabId, handleUndo, handleRedo, timeline]);


  // ── Drag & drop gambar ke kanvas ──────────────────────────────────────────
  function handleDrop(e: ReactDragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!e.dataTransfer) return;

    const point = docPointFromClient(e.clientX, e.clientY);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const imageFile = Array.from(files).find((f) => f.type.startsWith("image/"));
      if (imageFile) {
        layerManager.importImageFromFile(imageFile, point.x, point.y);
      }
      return;
    }

    const uri = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (uri && /^https?:\/\//.test(uri)) {
      layerManager.importImageFromUrl(uri, point.x, point.y);
    }
  }

  function handleDragOver(e: ReactDragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  // ── Paste gambar dari clipboard ────────────────────────────────────────────
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            loadImageFromFile(file).then((img) => layerManager.importImageAsLayer(img));
          }
          e.preventDefault();
          break;
        }
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  // ── View controls ─────────────────────────────────────────────────────────
  const resetView = useCallback(() => {
    const store = getActiveStore();
    if (!store) return;
    const fit = calculateFit(store.width, store.height);
    store.zoom = fit.zoom;
    store.panX = fit.panX;
    store.panY = fit.panY;
    store.rotation = fit.rotation;
    setZoom(fit.zoom);
    setPanX(fit.panX);
    setPanY(fit.panY);
    setRotation(fit.rotation);
  }, [activeTabId]);

  const resetRotation = useCallback(() => {
    setRotation(0);
  }, []);

  const exportImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "drawing.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  // ── Save/Load Project (.dwp) ──────────────────────────────────────────────
  const saveProject = useCallback(async () => {
    const store = getActiveStore();
    if (!store) return;

    const tabTitle = tabs.find((t) => t.id === activeTabId)?.title ?? "project";

    await saveProjectFile({
      title: tabTitle,
      width: store.width,
      height: store.height,
      layers: store.layers && store.layers.length > 0 ? store.layers : layers,
      activeLayerId: store.activeLayerId,
      layerCanvases: store.layerCanvases,
      frames: store.frames,
      fps: store.fps,
      currentFrameIndex: store.currentFrameIndex,
      onionSkinEnabled: store.onionSkinEnabled,
    });
  }, [activeTabId, tabs, layers]);

  const loadProjectFromFile = useCallback(async (file: File) => {
    const project = await loadProjectFile(file);

    const store = getActiveStore();
    if (!store) return;

    // Terapkan data proyek ke store aktif
    store.width = project.width;
    store.height = project.height;
    store.layers = project.layers;
    store.activeLayerId = project.activeLayerId;
    store.layerCanvases = project.layerCanvases;
    store.frames = project.frames.length > 0 ? project.frames : undefined;
    store.fps = project.fps;
    store.currentFrameIndex = project.currentFrameIndex;
    store.onionSkinEnabled = project.onionSkinEnabled;

    // Reset undo/redo history karena proyek baru dimuat
    store.history = new Map();
    store.redoHistory = new Map();

    // Perbarui canvas ukuran & recomposite
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = project.width;
      canvas.height = project.height;
      ctxRef.current = canvas.getContext("2d");
    }

    recomposite();
  }, [recomposite]);

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    // Refs untuk DrawingCanvas
    viewportRef,
    canvasRef,

    // Pointer & gesture handlers
    handlePointerDown,
    handlePointerMove: gestures.handlePointerMove,
    handlePointerUp: gestures.handlePointerUp,
    handleDrop,
    handleDragOver,

    // Layer state & actions
    layers,
    activeLayerId,
    addLayer: layerManager.addLayer,
    deleteLayer: layerManager.deleteLayer,
    toggleLayerVisibility: layerManager.toggleLayerVisibility,
    toggleLayerLock: layerManager.toggleLayerLock,
    toggleLayerClipped: layerManager.toggleLayerClipped,
    toggleLayerAlphaLock: layerManager.toggleLayerAlphaLock,
    setLayerOpacity: layerManager.setLayerOpacity,
    setLayerBlendMode: layerManager.setLayerBlendMode,
    selectLayer: layerManager.selectLayer,
    reorderLayer: layerManager.reorderLayer,

    // View state & actions
    zoom,
    panX,
    panY,
    rotation,
    resetView,
    resetRotation,

    // File actions & History
    exportImage,
    saveProject,
    loadProjectFromFile,
    undo: handleUndo,
    redo: handleRedo,
    canUndo,
    canRedo,

    // Info dimensi kanvas aktif
    canvasWidth: getActiveStore()?.width ?? tabs.find((t) => t.id === activeTabId)?.width ?? 1080,
    canvasHeight: getActiveStore()?.height ?? tabs.find((t) => t.id === activeTabId)?.height ?? 1080,

    // Text tool
    textTool,

    // Selection tools (rect & lasso)
    selectionTool,

    // Filters
    applyOutlineToActiveLayer,
    applyFilterToActiveLayer,

    // Animation timeline
    timeline,
  };
}