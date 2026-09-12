import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type ToolId = "brush" | "eraser";

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 560;
const MAX_HISTORY = 25;

export function useDrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawing = useRef<boolean>(false);
  const lastPoint = useRef<StrokePoint | null>(null);
  const history = useRef<ImageData[]>([]);

  const [tool, setTool] = useState<ToolId>("brush");
  const [color, setColor] = useState<string>("#111827");
  const [size, setSize] = useState<number>(6);
  const [canUndo, setCanUndo] = useState<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    canvas.style.width = `${CANVAS_WIDTH}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctxRef.current = ctx;
  }, []);

  const pushHistory = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    history.current.push(ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT));
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

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pushHistory();
    isDrawing.current = true;
    lastPoint.current = pointFromEvent(e);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const ctx = ctxRef.current;
    const last = lastPoint.current;
    if (!ctx || !last) return;

    const point = pointFromEvent(e);
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, size * (0.4 + point.pressure));
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

  const handleClear = () => {
    pushHistory();
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "drawing.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return {
    canvasRef,
    tool,
    setTool,
    color,
    setColor,
    size,
    setSize,
    canUndo,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleUndo,
    handleClear,
    handleExport,
  };
}