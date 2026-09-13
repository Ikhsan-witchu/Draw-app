import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type PointerEvent as ReactPointerEvent,
} from "react";

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

interface UseDrawingCanvasOptions {
  tool: string;
  color: string;
}

const MAX_HISTORY = 25;

export function useDrawingCanvas({ tool, color }: UseDrawingCanvasOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<StrokePoint | null>(null);
  const history = useRef<ImageData[]>([]);
  const sizeRef = useRef({ width: 0, height: 0 });

  const [canUndo, setCanUndo] = useState(false);

  const resizeCanvas = useCallback((cssWidth: number, cssHeight: number) => {
    const canvas = canvasRef.current;
    if (!canvas || cssWidth <= 0 || cssHeight <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const prevCtx = ctxRef.current;
    const prevWidth = canvas.width;
    const prevHeight = canvas.height;

    // Simpan isi kanvas lama sebelum resize (mengubah width/height akan menghapus isinya)
    let snapshot: HTMLCanvasElement | null = null;
    if (prevCtx && prevWidth > 0 && prevHeight > 0) {
      snapshot = document.createElement("canvas");
      snapshot.width = prevWidth;
      snapshot.height = prevHeight;
      snapshot.getContext("2d")?.drawImage(canvas, 0, 0);
    }

    const prevCssWidth = sizeRef.current.width;
    const prevCssHeight = sizeRef.current.height;

    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    if (snapshot) {
      ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, prevCssWidth, prevCssHeight);
    }

    ctxRef.current = ctx;
    sizeRef.current = { width: cssWidth, height: cssHeight };
    // Riwayat undo jadi tidak valid lagi setelah resize (ukuran ImageData lama sudah beda)
    history.current = [];
    setCanUndo(false);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      resizeCanvas(width, height);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [resizeCanvas]);

  const pushHistory = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    history.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (history.current.length > MAX_HISTORY) history.current.shift();
    setCanUndo(true);
  }, []);

  const pointFromEvent = (e: ReactPointerEvent<HTMLCanvasElement>): StrokePoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  };

  const isDrawable = tool === "brush" || tool === "eraser";

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pushHistory();
    isDrawing.current = true;
    lastPoint.current = pointFromEvent(e);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawable || !isDrawing.current) return;
    const ctx = ctxRef.current;
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
  };

  const handlePointerUp = () => {
    isDrawing.current = false;
    lastPoint.current = null;
  };

  const handleUndo = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const snapshot = history.current.pop();
    if (snapshot) ctx.putImageData(snapshot, 0, 0);
    setCanUndo(history.current.length > 0);
  };

  return {
    containerRef,
    canvasRef,
    canUndo,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleUndo,
  };
}
