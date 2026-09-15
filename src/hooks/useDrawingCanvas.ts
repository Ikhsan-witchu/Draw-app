import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
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
}

interface UseDrawingCanvasOptions {
  tool: string;
  color: string;
  documentWidth: number;
  documentHeight: number;
  onColorPick?: (hsl: { hue: number; sat: number; val: number }) => void;
  initialImage?: HTMLImageElement;
}

interface ZoomAnchor {
  docX: number;
  docY: number;
  clientX: number;
  clientY: number;
}

const MAX_HISTORY = 25;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 8;

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

export function useDrawingCanvas({
  tool,
  color,
  documentWidth,
  documentHeight,
  onColorPick,
  initialImage,
}: UseDrawingCanvasOptions) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const layerCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const historyRef = useRef<Map<string, ImageData[]>>(new Map());
  const layerCounterRef = useRef(0);

  const [layers, setLayers] = useState<LayerMeta[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  const isDrawing = useRef(false);
  const lastPoint = useRef<StrokePoint | null>(null);

  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const zoomAnchor = useRef<ZoomAnchor | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  function createLayerCanvas(): HTMLCanvasElement {
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    canvas.width = documentWidth * dpr;
    canvas.height = documentHeight * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    return canvas;
  }

  // Dokumen baru: siapkan kanvas komposit + layer pertama (diisi initialImage kalau ada)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = documentWidth * dpr;
    canvas.height = documentHeight * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctxRef.current = ctx;

    layerCounterRef.current = 1;
    const id = `layer-${Date.now()}`;
    const firstLayer = createLayerCanvas();
    if (initialImage) {
      const layerCtx = firstLayer.getContext("2d");
      layerCtx?.drawImage(initialImage, 0, 0, documentWidth, documentHeight);
    }
    layerCanvasesRef.current = new Map([[id, firstLayer]]);
    historyRef.current = new Map();
    setLayers([{ id, name: "Layer 1", visible: true }]);
    setActiveLayerId(id);

    const viewport = viewportRef.current;
    if (viewport) {
      const { width, height } = viewport.getBoundingClientRect();
      const fit = Math.min((width - 48) / documentWidth, (height - 48) / documentHeight, 1);
      setZoom(fit > 0 ? fit : 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentWidth, documentHeight]);

  function recomposite() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, documentWidth, documentHeight);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, documentWidth, documentHeight);

    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.visible) continue;
      const layerCanvas = layerCanvasesRef.current.get(layer.id);
      if (layerCanvas) {
        ctx.drawImage(layerCanvas, 0, 0, documentWidth, documentHeight);
      }
    }
  }

  useEffect(() => {
    recomposite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, documentWidth, documentHeight]);

  // --- Manajemen layer ---

  function addLayer() {
    layerCounterRef.current += 1;
    const id = `layer-${Date.now()}-${layerCounterRef.current}`;
    layerCanvasesRef.current.set(id, createLayerCanvas());
    setLayers((prev) => [{ id, name: `Layer ${layerCounterRef.current}`, visible: true }, ...prev]);
    setActiveLayerId(id);
  }

  function deleteLayer(id: string) {
    if (layers.length <= 1) return;
    const next = layers.filter((l) => l.id !== id);
    layerCanvasesRef.current.delete(id);
    historyRef.current.delete(id);
    setLayers(next);
    if (activeLayerId === id) {
      setActiveLayerId(next[0]?.id ?? null);
    }
  }

  function toggleLayerVisibility(id: string) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
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

  // Gambar yang diimpor (drop/paste) selalu jadi LAYER BARU di atas, bukan nimpa layer aktif
  function importImageAsLayer(image: HTMLImageElement, dropX?: number, dropY?: number) {
    layerCounterRef.current += 1;
    const id = `layer-${Date.now()}-${layerCounterRef.current}`;
    const layerCanvas = createLayerCanvas();
    const ctx = layerCanvas.getContext("2d");
    if (ctx) {
      const w = image.naturalWidth || image.width;
      const h = image.naturalHeight || image.height;
      const x = dropX !== undefined ? dropX - w / 2 : (documentWidth - w) / 2;
      const y = dropY !== undefined ? dropY - h / 2 : (documentHeight - h) / 2;
      try {
        ctx.drawImage(image, x, y, w, h);
      } catch {
        // Gambar lintas-origin tanpa izin CORS dari server sumbernya bisa gagal digambar; diamkan saja.
      }
    }
    layerCanvasesRef.current.set(id, layerCanvas);
    setLayers((prev) => [{ id, name: `Image ${layerCounterRef.current}`, visible: true }, ...prev]);
    setActiveLayerId(id);
  }

  // --- Zoom (scroll wheel, ke arah kursor) + pan (middle-click drag) ---

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas) return;

    canvas.style.width = `${documentWidth * zoom}px`;
    canvas.style.height = `${documentHeight * zoom}px`;

    const anchor = zoomAnchor.current;
    if (anchor && viewport) {
      const canvasRect = canvas.getBoundingClientRect();
      const newCursorX = anchor.docX * zoom;
      const newCursorY = anchor.docY * zoom;
      const desiredLeft = anchor.clientX - newCursorX;
      const desiredTop = anchor.clientY - newCursorY;
      viewport.scrollLeft += canvasRect.left - desiredLeft;
      viewport.scrollTop += canvasRect.top - desiredTop;
      zoomAnchor.current = null;
    }
  }, [zoom, documentWidth, documentHeight]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const currentCanvas = canvasRef.current;
      if (!currentCanvas) return;

      const currentZoom = zoomRef.current;
      const rect = currentCanvas.getBoundingClientRect();
      const docX = (e.clientX - rect.left) / currentZoom;
      const docY = (e.clientY - rect.top) / currentZoom;

      const factor = Math.exp(-e.deltaY * 0.001);
      const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, currentZoom * factor));

      zoomAnchor.current = { docX, docY, clientX: e.clientX, clientY: e.clientY };
      setZoom(nextZoom);
    }

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  function handlePanMove(e: PointerEvent) {
    if (!isPanning.current) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft = panStart.current.scrollLeft - (e.clientX - panStart.current.x);
    viewport.scrollTop = panStart.current.scrollTop - (e.clientY - panStart.current.y);
  }

  function handlePanEnd() {
    isPanning.current = false;
    window.removeEventListener("pointermove", handlePanMove);
    window.removeEventListener("pointerup", handlePanEnd);
  }

  // --- Konversi koordinat layar -> koordinat dokumen ---

  function docPointFromClient(clientX: number, clientY: number): { x: number; y: number } {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoomRef.current,
      y: (clientY - rect.top) / zoomRef.current,
    };
  }

  const pointFromEvent = (e: ReactPointerEvent<HTMLCanvasElement>): StrokePoint => {
    const { x, y } = docPointFromClient(e.clientX, e.clientY);
    return { x, y, pressure: e.pressure > 0 ? e.pressure : 0.5 };
  };

  const isDrawable = tool === "brush" || tool === "eraser";

  function pushHistory() {
    if (!activeLayerId) return;
    const layerCanvas = layerCanvasesRef.current.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!ctx || !layerCanvas) return;
    const stack = historyRef.current.get(activeLayerId) ?? [];
    stack.push(ctx.getImageData(0, 0, layerCanvas.width, layerCanvas.height));
    if (stack.length > MAX_HISTORY) stack.shift();
    historyRef.current.set(activeLayerId, stack);
  }

  function handleBucketFill(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!activeLayerId) return;
    const layerCanvas = layerCanvasesRef.current.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!ctx || !layerCanvas) return;

    const point = pointFromEvent(e);
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

  function handleEyedropperPick(e: ReactPointerEvent<HTMLCanvasElement>) {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const point = pointFromEvent(e);
    const dpr = window.devicePixelRatio || 1;
    const px = Math.floor(point.x * dpr);
    const py = Math.floor(point.y * dpr);
    if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return;

    const pixel = ctx.getImageData(px, py, 1, 1).data;
    onColorPick?.(rgbToHsl(pixel[0], pixel[1], pixel[2]));
  }

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.button === 1) {
      e.preventDefault();
      const viewport = viewportRef.current;
      isPanning.current = true;
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: viewport?.scrollLeft ?? 0,
        scrollTop: viewport?.scrollTop ?? 0,
      };
      window.addEventListener("pointermove", handlePanMove);
      window.addEventListener("pointerup", handlePanEnd);
      return;
    }

    if (e.button !== 0) return;

    if (tool === "bucket") {
      handleBucketFill(e);
      return;
    }

    if (tool === "eyedropper") {
      handleEyedropperPick(e);
      return;
    }

    if (!isDrawable || !activeLayerId) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pushHistory();
    isDrawing.current = true;
    lastPoint.current = pointFromEvent(e);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawable || !isDrawing.current || !activeLayerId) return;
    const layerCanvas = layerCanvasesRef.current.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    const last = lastPoint.current;
    if (!ctx || !last) return;

    const point = pointFromEvent(e);
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, 6 * (0.4 + point.pressure));
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    lastPoint.current = point;
    recomposite();
  };

  const handlePointerUp = () => {
    isDrawing.current = false;
    lastPoint.current = null;
  };

  function handleUndo() {
    if (!activeLayerId) return;
    const layerCanvas = layerCanvasesRef.current.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!ctx) return;
    const stack = historyRef.current.get(activeLayerId);
    const snapshot = stack?.pop();
    if (snapshot) {
      ctx.putImageData(snapshot, 0, 0);
      recomposite();
    }
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
  }, [activeLayerId]);

  // --- Impor gambar: drag file dari luar / drag dari browser, dan paste ---

  function handleDrop(e: ReactDragEvent<HTMLCanvasElement>) {
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

    // Drag gambar dari halaman web lain biasanya bawa URL, bukan file
    const uri = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (uri && /^https?:\/\//.test(uri)) {
      loadImageFromUrl(uri)
        .then((img) => importImageAsLayer(img, point.x, point.y))
        .catch(() => {
          // Kemungkinan besar dibatasi CORS oleh server sumber gambar — gagal secara diam-diam
        });
    }
  }

  function handleDragOver(e: ReactDragEvent<HTMLCanvasElement>) {
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
  }, []);

  function exportImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "drawing.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

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
    selectLayer,
    reorderLayer,
    exportImage,
  };
}