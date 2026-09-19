import {
  useRef,
  useState,
  useEffect,
  type PointerEvent as ReactPointerEvent,
  type DragEvent as ReactDragEvent,
} from "react";

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface LayerMeta {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface DocumentTab {
  id: string;
  title: string;
  width: number;
  height: number;
  initialImage?: HTMLImageElement;
}

interface TabStore {
  width: number;
  height: number;
  layers: LayerMeta[];
  activeLayerId: string | null;
  layerCanvases: Map<string, HTMLCanvasElement>;
  history: Map<string, ImageData[]>;
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
}

interface UseDrawingCanvasOptions {
  tool: string;
  color: string;
  tabs: DocumentTab[];
  activeTabId: string | null;
  onColorPick?: (hsl: { hue: number; sat: number; val: number }) => void;
}

const MAX_HISTORY = 25;
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 20;

function hslStringToRgb(hslString: string): [number, number, number] {
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

function rgbToHsl(r: number, g: number, b: number): { hue: number; sat: number; val: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }

  return { hue: Math.round(h * 360), sat: Math.round(s * 100), val: Math.round(l * 100) };
}

function colorsMatch(
  r1: number,
  g1: number,
  b1: number,
  a1: number,
  r2: number,
  g2: number,
  b2: number,
  a2: number,
  tolerance: number,
) {
  return (
    Math.abs(r1 - r2) <= tolerance &&
    Math.abs(g1 - g2) <= tolerance &&
    Math.abs(b1 - b2) <= tolerance &&
    Math.abs(a1 - a2) <= tolerance
  );
}

function floodFill(
  imageData: ImageData,
  startX: number,
  startY: number,
  fillColor: [number, number, number, number],
  tolerance: number,
) {
  const { width, height, data } = imageData;
  const startIdx = (startY * width + startX) * 4;
  const startR = data[startIdx];
  const startG = data[startIdx + 1];
  const startB = data[startIdx + 2];
  const startA = data[startIdx + 3];

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

    let xLeft = x;
    while (xLeft > 0 && !visited[y * width + (xLeft - 1)] && matches((y * width + (xLeft - 1)) * 4)) xLeft--;
    let xRight = x;
    while (xRight < width - 1 && !visited[y * width + (xRight + 1)] && matches((y * width + (xRight + 1)) * 4))
      xRight++;

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

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
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

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function createLayerCanvas(width: number, height: number): HTMLCanvasElement {
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }
  return canvas;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nextAvailableName(existingNames: string[], prefix: string): string {
  let n = 1;
  while (existingNames.includes(`${prefix} ${n}`)) {
    n++;
  }
  return `${prefix} ${n}`;
}

interface PointerInfo {
  id: number;
  clientX: number;
  clientY: number;
  pointerType: string;
}

interface GestureState {
  initialDist: number;
  initialAngle: number;
  initialMidX: number;
  initialMidY: number;
  startZoom: number;
  startPanX: number;
  startPanY: number;
  startRotation: number;
}

export function useDrawingCanvas({ tool, color, tabs, activeTabId, onColorPick }: UseDrawingCanvasOptions) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const tabStoresRef = useRef<Map<string, TabStore>>(new Map());
  const justInitializedRef = useRef<Set<string>>(new Set());

  const [layers, setLayers] = useState<LayerMeta[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  // Transform states
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [rotation, setRotation] = useState(0);

  const zoomRef = useRef(1);
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  const rotationRef = useRef(0);

  const isDrawing = useRef(false);
  const lastPoint = useRef<StrokePoint | null>(null);
  const isMousePanning = useRef(false);
  const mousePanStart = useRef({ clientX: 0, clientY: 0, startPanX: 0, startPanY: 0 });
  const prevActiveTabIdRef = useRef<string | null>(null);

  // Multi-touch gestures
  const activePointers = useRef<Map<number, PointerInfo>>(new Map());
  const isGestureActive = useRef(false);
  const ignoreUntilAllUp = useRef(false);
  const strokePreSnapshot = useRef<ImageData | null>(null);
  const gestureState = useRef<GestureState | null>(null);

  function getActiveStore(): TabStore | undefined {
    return activeTabId ? tabStoresRef.current.get(activeTabId) : undefined;
  }

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    panXRef.current = panX;
  }, [panX]);
  useEffect(() => {
    panYRef.current = panY;
  }, [panY]);
  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  function calculateFit(tabWidth: number, tabHeight: number) {
    const viewport = viewportRef.current;
    if (!viewport) return { zoom: 1, panX: 0, panY: 0, rotation: 0 };
    const { width: vw, height: vh } = viewport.getBoundingClientRect();
    const pad = 36;
    const fit = Math.min((vw - pad) / tabWidth, (vh - pad) / tabHeight, 1);
    return {
      zoom: fit > 0 ? fit : 1,
      panX: 0,
      panY: 0,
      rotation: 0,
    };
  }

  // Inisialisasi store buat tab baru, buang store tab yang udah ditutup
  useEffect(() => {
    for (const tab of tabs) {
      if (tabStoresRef.current.has(tab.id)) continue;

      const backgroundId = generateId("layer");
      const layerOneId = generateId("layer");

      const backgroundCanvas = createLayerCanvas(tab.width, tab.height);
      if (tab.initialImage) {
        const bgCtx = backgroundCanvas.getContext("2d");
        bgCtx?.drawImage(tab.initialImage, 0, 0, tab.width, tab.height);
      }
      const layerOneCanvas = createLayerCanvas(tab.width, tab.height);

      const fit = calculateFit(tab.width, tab.height);

      tabStoresRef.current.set(tab.id, {
        width: tab.width,
        height: tab.height,
        layers: [
          { id: layerOneId, name: "Layer 1", visible: true, locked: false },
          { id: backgroundId, name: "Background", visible: true, locked: false },
        ],
        activeLayerId: layerOneId,
        layerCanvases: new Map([
          [layerOneId, layerOneCanvas],
          [backgroundId, backgroundCanvas],
        ]),
        history: new Map(),
        zoom: fit.zoom,
        panX: fit.panX,
        panY: fit.panY,
        rotation: fit.rotation,
      });
      justInitializedRef.current.add(tab.id);
    }

    for (const key of Array.from(tabStoresRef.current.keys())) {
      if (!tabs.some((t) => t.id === key)) {
        tabStoresRef.current.delete(key);
      }
    }

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

    const store = getActiveStore();
    const canvas = canvasRef.current;
    if (store && canvas) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = store.width * dpr;
      canvas.height = store.height * dpr;
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
    }
    prevActiveTabIdRef.current = activeTabId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, activeTabId]);

  function recomposite() {
    const ctx = ctxRef.current;
    const store = getActiveStore();
    if (!ctx || !store) return;
    ctx.clearRect(0, 0, store.width, store.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, store.width, store.height);

    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.visible) continue;
      const layerCanvas = store.layerCanvases.get(layer.id);
      if (layerCanvas) {
        ctx.drawImage(layerCanvas, 0, 0, store.width, store.height);
      }
    }
  }

  useEffect(() => {
    recomposite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, activeTabId]);

  useEffect(() => {
    if (activeTabId && justInitializedRef.current.has(activeTabId)) {
      justInitializedRef.current.delete(activeTabId);
      return;
    }
    const store = getActiveStore();
    if (store) {
      store.layers = layers;
      store.activeLayerId = activeLayerId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, activeLayerId]);

  useEffect(() => {
    const store = getActiveStore();
    if (store) {
      store.zoom = zoom;
      store.panX = panX;
      store.panY = panY;
      store.rotation = rotation;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, panX, panY, rotation]);

  // --- Layer Management ---
  function addLayer() {
    const store = getActiveStore();
    if (!store) return;
    const id = generateId("layer");
    const name = nextAvailableName(
      layers.map((l) => l.name),
      "Layer",
    );
    store.layerCanvases.set(id, createLayerCanvas(store.width, store.height));
    setLayers((prev) => [{ id, name, visible: true, locked: false }, ...prev]);
    setActiveLayerId(id);
  }

  function deleteLayer(id: string) {
    const store = getActiveStore();
    if (!store || layers.length <= 1) return;
    const deletedLayer = layers.find((l) => l.id === id);
    let next = layers.filter((l) => l.id !== id);

    if (deletedLayer?.name === "Background" && next.length > 0) {
      const bottomIndex = next.length - 1;
      next = next.map((l, i) => (i === bottomIndex ? { ...l, name: "Background" } : l));
    }

    store.layerCanvases.delete(id);
    store.history.delete(id);
    setLayers(next);
    if (activeLayerId === id) {
      setActiveLayerId(next[0]?.id ?? null);
    }
  }

  function toggleLayerVisibility(id: string) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
  }

  function toggleLayerLock(id: string) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)));
  }

  function selectLayer(id: string) {
    setActiveLayerId(id);
  }

  function reorderLayer(draggedId: string, targetId: string, position: "before" | "after") {
    if (draggedId === targetId) return;
    setLayers((prev) => {
      const dragged = prev.find((l) => l.id === draggedId);
      if (!dragged) return prev;
      const withoutDragged = prev.filter((l) => l.id !== draggedId);
      const targetIndex = withoutDragged.findIndex((l) => l.id === targetId);
      if (targetIndex === -1) return prev;
      const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
      const next = [...withoutDragged];
      next.splice(insertIndex, 0, dragged);
      return next;
    });
  }

  function importImageAsLayer(image: HTMLImageElement, dropX?: number, dropY?: number) {
    const store = getActiveStore();
    if (!store) return;
    const id = generateId("layer");
    const name = nextAvailableName(
      layers.map((l) => l.name),
      "Image",
    );
    const layerCanvas = createLayerCanvas(store.width, store.height);
    const ctx = layerCanvas.getContext("2d");
    if (ctx) {
      const w = image.naturalWidth || image.width;
      const h = image.naturalHeight || image.height;
      const x = dropX !== undefined ? dropX - w / 2 : (store.width - w) / 2;
      const y = dropY !== undefined ? dropY - h / 2 : (store.height - h) / 2;
      try {
        ctx.drawImage(image, x, y, w, h);
      } catch {
        // Ignored
      }
    }
    store.layerCanvases.set(id, layerCanvas);
    setLayers((prev) => [{ id, name, visible: true, locked: false }, ...prev]);
    setActiveLayerId(id);
  }

  // --- Exact Coordinate Transformation (Screen -> Document Coordinates) ---
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

    const curZoom = zoomRef.current;
    const unscaledX = rotX / curZoom;
    const unscaledY = rotY / curZoom;

    return {
      x: unscaledX + store.width / 2,
      y: unscaledY + store.height / 2,
    };
  }

  const isDrawable = tool === "brush" || tool === "eraser";

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

  function drawStrokeSegment(from: StrokePoint, to: StrokePoint) {
    const store = getActiveStore();
    if (!store || !activeLayerId) return;
    const layerCanvas = store.layerCanvases.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!ctx) return;

    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1, 6 * (0.4 + to.pressure));

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    recomposite();
  }

  // --- Multi-Touch Gesture & Pointer Handlers ---
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();

    activePointers.current.set(e.pointerId, {
      id: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      pointerType: e.pointerType,
    });

    if (ignoreUntilAllUp.current) {
      return;
    }

    // Mouse middle click or Move tool -> desktop mouse pan
    if (e.pointerType === "mouse" && (e.button === 1 || tool === "move")) {
      isMousePanning.current = true;
      mousePanStart.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        startPanX: panXRef.current,
        startPanY: panYRef.current,
      };
      return;
    }

    // Multi-touch: 2 or more fingers detected (Ibis Paint gesture)
    if (activePointers.current.size >= 2) {
      // Revert initial touch mark if finger 1 started drawing
      if (isDrawing.current) {
        isDrawing.current = false;
        lastPoint.current = null;
        if (strokePreSnapshot.current) {
          const store = getActiveStore();
          if (store && activeLayerId) {
            const layerCanvas = store.layerCanvases.get(activeLayerId);
            const ctx = layerCanvas?.getContext("2d");
            if (ctx) {
              ctx.putImageData(strokePreSnapshot.current, 0, 0);
              recomposite();
            }
            const stack = store.history.get(activeLayerId);
            if (stack && stack.length > 0) {
              stack.pop();
            }
          }
          strokePreSnapshot.current = null;
        }
      }

      isGestureActive.current = true;
      const pts = Array.from(activePointers.current.values());
      const p1 = pts[0];
      const p2 = pts[1];
      const dist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
      const angle = Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX);
      const midX = (p1.clientX + p2.clientX) / 2;
      const midY = (p1.clientY + p2.clientY) / 2;

      gestureState.current = {
        initialDist: Math.max(dist, 10),
        initialAngle: angle,
        initialMidX: midX,
        initialMidY: midY,
        startZoom: zoomRef.current,
        startPanX: panXRef.current,
        startPanY: panYRef.current,
        startRotation: rotationRef.current,
      };
      return;
    }

    // Single touch or left mouse click
    if (activePointers.current.size === 1) {
      if (e.button !== 0 && e.pointerType === "mouse") return;

      const store = getActiveStore();
      if (!store) return;

      const docPt = docPointFromClient(e.clientX, e.clientY);
      const isInsideCanvas =
        docPt.x >= 0 && docPt.x <= store.width && docPt.y >= 0 && docPt.y <= store.height;

      if (!isInsideCanvas) {
        return;
      }

      if (tool === "bucket") {
        handleBucketFill(e.clientX, e.clientY);
        return;
      }

      if (tool === "eyedropper") {
        handleEyedropperPick(e.clientX, e.clientY);
        return;
      }

      if (!isDrawable || !activeLayerId) return;
      const activeLayerMeta = layers.find((l) => l.id === activeLayerId);
      if (activeLayerMeta?.locked || !activeLayerMeta?.visible) return;

      const layerCanvas = store.layerCanvases.get(activeLayerId);
      const ctx = layerCanvas?.getContext("2d");
      if (ctx && layerCanvas) {
        strokePreSnapshot.current = ctx.getImageData(0, 0, layerCanvas.width, layerCanvas.height);
      }

      pushHistory();
      isDrawing.current = true;
      const startPt: StrokePoint = {
        x: docPt.x,
        y: docPt.y,
        pressure: e.pressure > 0 ? e.pressure : 0.5,
      };
      lastPoint.current = startPt;
      drawStrokeSegment(startPt, startPt);
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, {
        id: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        pointerType: e.pointerType,
      });
    }

    // Mouse panning
    if (isMousePanning.current) {
      const deltaX = e.clientX - mousePanStart.current.clientX;
      const deltaY = e.clientY - mousePanStart.current.clientY;
      setPanX(mousePanStart.current.startPanX + deltaX);
      setPanY(mousePanStart.current.startPanY + deltaY);
      return;
    }

    // 2-Finger Gestures (Pinch zoom, Pan, Rotate paper)
    if (isGestureActive.current && activePointers.current.size >= 2) {
      const pts = Array.from(activePointers.current.values());
      const p1 = pts[0];
      const p2 = pts[1];
      const dist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
      const angle = Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX);
      const midX = (p1.clientX + p2.clientX) / 2;
      const midY = (p1.clientY + p2.clientY) / 2;

      const gs = gestureState.current;
      if (!gs) return;

      const scaleFactor = dist / gs.initialDist;
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, gs.startZoom * scaleFactor));

      const angleDiffDeg = ((angle - gs.initialAngle) * 180) / Math.PI;
      let newRotation = (gs.startRotation + angleDiffDeg) % 360;
      const normalizedRot = ((newRotation % 360) + 360) % 360;
      if (normalizedRot < 3.5 || normalizedRot > 356.5) newRotation = 0;
      else if (Math.abs(normalizedRot - 90) < 3.5) newRotation = 90;
      else if (Math.abs(normalizedRot - 180) < 3.5) newRotation = 180;
      else if (Math.abs(normalizedRot - 270) < 3.5) newRotation = 270;

      const deltaMidX = midX - gs.initialMidX;
      const deltaMidY = midY - gs.initialMidY;

      const viewport = viewportRef.current;
      if (viewport) {
        const vRect = viewport.getBoundingClientRect();
        const viewCenterX = vRect.left + vRect.width / 2;
        const viewCenterY = vRect.top + vRect.height / 2;

        const vx = gs.initialMidX - (viewCenterX + gs.startPanX);
        const vy = gs.initialMidY - (viewCenterY + gs.startPanY);
        const zoomRatio = newZoom / gs.startZoom;

        const newPanX = gs.startPanX + deltaMidX + vx * (1 - zoomRatio);
        const newPanY = gs.startPanY + deltaMidY + vy * (1 - zoomRatio);

        setZoom(newZoom);
        setRotation(newRotation);
        setPanX(newPanX);
        setPanY(newPanY);
      }
      return;
    }

    // Single pointer brush drawing
    if (!ignoreUntilAllUp.current && isDrawing.current && activePointers.current.size === 1 && activeLayerId) {
      const activeLayerMeta = layers.find((l) => l.id === activeLayerId);
      if (activeLayerMeta?.locked || !activeLayerMeta?.visible) return;

      const pt = docPointFromClient(e.clientX, e.clientY);
      const currentPt: StrokePoint = {
        x: pt.x,
        y: pt.y,
        pressure: e.pressure > 0 ? e.pressure : 0.5,
      };

      if (lastPoint.current) {
        drawStrokeSegment(lastPoint.current, currentPt);
      }
      lastPoint.current = currentPt;
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId);

    if (isMousePanning.current) {
      isMousePanning.current = false;
    }

    if (isGestureActive.current) {
      if (activePointers.current.size < 2) {
        isGestureActive.current = false;
        gestureState.current = null;
        ignoreUntilAllUp.current = true;
      }
    }

    if (activePointers.current.size === 0) {
      isDrawing.current = false;
      lastPoint.current = null;
      strokePreSnapshot.current = null;
      ignoreUntilAllUp.current = false;
    }
  };

  // Mouse wheel zoom
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const curZoom = zoomRef.current;
      const factor = Math.exp(-e.deltaY * 0.001);
      const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, curZoom * factor));

      const vRect = viewport!.getBoundingClientRect();
      const viewCenterX = vRect.left + vRect.width / 2;
      const viewCenterY = vRect.top + vRect.height / 2;

      const vx = e.clientX - (viewCenterX + panXRef.current);
      const vy = e.clientY - (viewCenterY + panYRef.current);
      const zoomRatio = nextZoom / curZoom;

      const nextPanX = panXRef.current + vx * (1 - zoomRatio);
      const nextPanY = panYRef.current + vy * (1 - zoomRatio);

      setZoom(nextZoom);
      setPanX(nextPanX);
      setPanY(nextPanY);
    }

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

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
    }
  }

  function exportImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "drawing.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z";
      if (isUndo) {
        e.preventDefault();
        handleUndo();
        return;
      }

      const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      if (isSave) {
        e.preventDefault();
        exportImage();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayerId, activeTabId]);

  function handleDrop(e: ReactDragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!e.dataTransfer) return;
    const point = docPointFromClient(e.clientX, e.clientY);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const imageFile = Array.from(files).find((f) => f.type.startsWith("image/"));
      if (imageFile) {
        loadImageFromFile(imageFile).then((img) => importImageAsLayer(img, point.x, point.y));
      }
      return;
    }

    const uri = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (uri && /^https?:\/\//.test(uri)) {
      loadImageFromUrl(uri)
        .then((img) => importImageAsLayer(img, point.x, point.y))
        .catch(() => {
          // CORS error silently handled
        });
    }
  }

  function handleDragOver(e: ReactDragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            loadImageFromFile(file).then((img) => importImageAsLayer(img));
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

  return {
    viewportRef,
    canvasRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDrop,
    handleDragOver,
    layers,
    activeLayerId,
    addLayer,
    deleteLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    selectLayer,
    reorderLayer,
    exportImage,
    undo: handleUndo,
    zoom,
    panX,
    panY,
    rotation,
    resetView,
    resetRotation,
    canvasWidth: getActiveStore()?.width ?? 1080,
    canvasHeight: getActiveStore()?.height ?? 1080,
  };
}