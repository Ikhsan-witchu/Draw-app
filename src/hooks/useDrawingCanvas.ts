// ─── Hook utama: orchestrator kanvas drawing ──────────────────────────────────

import { useRef, useState, useEffect, type DragEvent as ReactDragEvent } from "react";
import type { LayerMeta, TabStore, UseDrawingCanvasOptions } from "../types/drawing";
import { MAX_HISTORY } from "../types/drawing";
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

  // ── Helper: ambil store tab aktif ─────────────────────────────────────────
  function getActiveStore(): TabStore | undefined {
    return activeTabId ? tabStoresRef.current.get(activeTabId) : undefined;
  }

  // ── Hitung zoom fit-to-viewport ───────────────────────────────────────────
  function calculateFit(tabWidth: number, tabHeight: number) {
    const viewport = viewportRef.current;
    if (!viewport) return { zoom: 1, panX: 0, panY: 0, rotation: 0 };

    const { width: vw, height: vh } = viewport.getBoundingClientRect();
    const pad = 36;
    const fit = Math.min((vw - pad) / tabWidth, (vh - pad) / tabHeight, 1);

    return { zoom: fit > 0 ? fit : 1, panX: 0, panY: 0, rotation: 0 };
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
        if (tab.initialImage) {
          const bgCtx = backgroundCanvas.getContext("2d");
          bgCtx?.drawImage(tab.initialImage, 0, 0, tab.width, tab.height);
        }

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
          zoom: 1,
          panX: 0,
          panY: 0,
          rotation: 0,
        });

        // Tab baru selalu di-fit ke viewport setelah render pertama
        needsFitRef.current.add(tab.id);

        if (tab.initialImage) {
          saveLayerCanvasBlob(tab.id, backgroundId, backgroundCanvas);
        }
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
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(store.width * dpr);
      canvas.height = Math.round(store.height * dpr);

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
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

  // ── Deferred fit-to-viewport ───────────────────────────────────────────────
  // Viewport belum punya ukuran saat tab store dibuat (masih dalam render phase),
  // jadi kita tunda fit hingga setelah paint berikutnya.
  useEffect(() => {
    if (!activeTabId) return;
    if (!needsFitRef.current.has(activeTabId)) return;

    const raf = requestAnimationFrame(() => {
      if (!needsFitRef.current.has(activeTabId)) return;
      const store = tabStoresRef.current.get(activeTabId);
      if (!store) return;

      const fit = calculateFit(store.width, store.height);
      // Viewport bisa saja masih belum siap (mis. 0×0) → jangan terapkan
      if (fit.zoom <= 0 || !viewportRef.current) return;

      store.zoom = fit.zoom;
      store.panX = fit.panX;
      store.panY = fit.panY;
      store.rotation = fit.rotation;

      setZoom(fit.zoom);
      setPanX(fit.panX);
      setPanY(fit.panY);
      setRotation(fit.rotation);

      needsFitRef.current.delete(activeTabId);
    });

    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, tabs]);

  // ── Compositing: gabungkan semua layer yang visible ke main canvas ─────────
  function recomposite() {
    const store = getActiveStore();
    if (!store) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(store.width * dpr);
    const targetH = Math.round(store.height * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH || !ctxRef.current) {
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctxRef.current = ctx;
      }
    }

    const ctx = ctxRef.current;
    if (!ctx) return;

    const currentLayers = (store.layers && store.layers.length > 0) ? store.layers : layers;
    if (!currentLayers || currentLayers.length === 0) return;

    ctx.clearRect(0, 0, store.width, store.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, store.width, store.height);

    for (let i = currentLayers.length - 1; i >= 0; i--) {
      const layer = currentLayers[i];
      if (!layer.visible) continue;
      const layerCanvas = store.layerCanvases.get(layer.id);
      if (layerCanvas) {
        ctx.globalAlpha = (layer.opacity ?? 100) / 100;
        ctx.globalCompositeOperation = layer.blendMode ?? "source-over";
        ctx.drawImage(layerCanvas, 0, 0, store.width, store.height);
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

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

  // ── History ────────────────────────────────────────────────────────────────
  function pushHistory() {
    const store = getActiveStore();
    if (!store || !activeLayerId) return;

    const layerCanvas = store.layerCanvases.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!ctx || !layerCanvas) return;

    const stack = store.history.get(activeLayerId) ?? [];
    stack.push(ctx.getImageData(0, 0, layerCanvas.width, layerCanvas.height));
    if (stack.length > MAX_HISTORY) stack.shift();
    store.history.set(activeLayerId, stack);
  }

  function handleUndo() {
    const store = getActiveStore();
    if (!store || !activeLayerId) return;

    const layerCanvas = store.layerCanvases.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!ctx) return;

    const stack = store.history.get(activeLayerId);
    const snapshot = stack?.pop();
    if (snapshot) {
      ctx.putImageData(snapshot, 0, 0);
      recomposite();
      persistActiveLayerContent();
    }
  }

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
    const dpr = window.devicePixelRatio || 1;
    const px = Math.floor(point.x * dpr);
    const py = Math.floor(point.y * dpr);
    if (px < 0 || py < 0 || px >= layerCanvas.width || py >= layerCanvas.height) return;

    pushHistory();

    const imageData = ctx.getImageData(0, 0, layerCanvas.width, layerCanvas.height);
    const [r, g, b] = hslStringToRgb(color);
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
    const dpr = window.devicePixelRatio || 1;
    const px = Math.floor(point.x * dpr);
    const py = Math.floor(point.y * dpr);
    if (px < 0 || py < 0 || px >= store.width * dpr || py >= store.height * dpr) return;

    const pixel = ctx.getImageData(px, py, 1, 1).data;
    onColorPick?.(rgbToHsl(pixel[0], pixel[1], pixel[2]));
  }

  // ── Drawing stroke ─────────────────────────────────────────────────────────
  function drawStrokeSegment(
    from: { x: number; y: number; pressure: number },
    to: { x: number; y: number; pressure: number },
  ) {
    const store = getActiveStore();
    if (!store || !activeLayerId) return;

    const layerCanvas = store.layerCanvases.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!ctx) return;

    const isEraser = tool === "eraser";
    const opacityFactor = (brushOpacity ?? 100) / 100;
    dispatchBrush(brushType, ctx, from, to, Math.max(1, brushSize), color, isEraser, opacityFactor);
    recomposite();
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

  function handleShapePreview(from: { x: number; y: number }, to: { x: number; y: number }) {
    const store = getActiveStore();
    const ctx = ctxRef.current;
    if (!store || !ctx) return;

    recomposite();
    renderShapeToContext(ctx, from, to, store.width, store.height);
  }

  function handleShapeCommit(from: { x: number; y: number }, to: { x: number; y: number }) {
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

  // ── Gesture & pointer handler ─────────────────────────────────────────────
  const { handlePointerDown, handlePointerMove, handlePointerUp } = useCanvasGestures({
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
    onStrokeComplete: persistActiveLayerContent,
  });

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (isMod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        exportImage();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayerId, activeTabId]);

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
  function resetView() {
    const store = getActiveStore();
    if (!store) return;
    const fit = calculateFit(store.width, store.height);
    setZoom(fit.zoom);
    setPanX(fit.panX);
    setPanY(fit.panY);
    setRotation(fit.rotation);
  }

  function resetRotation() {
    setRotation(0);
  }

  function exportImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "drawing.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    // Refs untuk DrawingCanvas
    viewportRef,
    canvasRef,

    // Pointer & gesture handlers
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDrop,
    handleDragOver,

    // Layer state & actions
    layers,
    activeLayerId,
    addLayer: layerManager.addLayer,
    deleteLayer: layerManager.deleteLayer,
    toggleLayerVisibility: layerManager.toggleLayerVisibility,
    toggleLayerLock: layerManager.toggleLayerLock,
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

    // File actions
    exportImage,
    undo: handleUndo,

    // Info dimensi kanvas aktif
    canvasWidth: getActiveStore()?.width ?? tabs.find((t) => t.id === activeTabId)?.width ?? 1080,
    canvasHeight: getActiveStore()?.height ?? tabs.find((t) => t.id === activeTabId)?.height ?? 1080,
  };
}