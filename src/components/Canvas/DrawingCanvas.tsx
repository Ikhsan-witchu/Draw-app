import { useRef, useState, useEffect, useCallback } from "react";
import { Pencil, Eraser, Undo2, Trash2, Download, type LucideIcon } from "lucide-react";

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 560;
const MAX_HISTORY = 25;

type ToolId = "brush" | "eraser";

interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export default function DrawingCanvas() {
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

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pushHistory();
    isDrawing.current = true;
    lastPoint.current = pointFromEvent(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
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

  const toolButton = (id: ToolId, Icon: LucideIcon, label: string) => (
    <button
      onClick={() => setTool(id)}
      title={label}
      className={`p-2 rounded-md transition-colors ${
        tool === id
          ? "bg-white text-neutral-900"
          : "text-neutral-400 hover:text-white hover:bg-neutral-800"
      }`}
    >
      <Icon size={18} />
    </button>
  );

  return (
    <div className="flex flex-col h-screen bg-neutral-950">
      <div className="flex items-center gap-4 px-4 py-3 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center gap-1">
          {toolButton("brush", Pencil, "Brush")}
          {toolButton("eraser", Eraser, "Eraser")}
        </div>

        <div className="w-px h-6 bg-neutral-800" />

        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer bg-transparent border border-neutral-700"
        />

        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Size</span>
          <input
            type="range"
            min={1}
            max={48}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-28 accent-white"
          />
          <span className="text-xs text-neutral-500 w-6 text-right">{size}</span>
        </div>

        <div className="w-px h-6 bg-neutral-800" />

        <button
          onClick={handleUndo}
          disabled={!canUndo}
          className="p-2 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Undo"
        >
          <Undo2 size={18} />
        </button>
        <button
          onClick={handleClear}
          className="p-2 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800"
          title="Clear canvas"
        >
          <Trash2 size={18} />
        </button>
        <button
          onClick={handleExport}
          className="p-2 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800"
          title="Export PNG"
        >
          <Download size={18} />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center overflow-auto p-6">
        <canvas
          ref={canvasRef}
          className="bg-white rounded-sm shadow-2xl touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
    </div>
  );
}
