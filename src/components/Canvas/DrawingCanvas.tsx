import {
  useRef,
  useEffect,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { RotateCcw, Maximize2 } from "lucide-react";
import { TabBar } from "../Workspace/TabBar";
import type { DocumentTab } from "../../hooks/useDrawingCanvas";

interface DrawingCanvasProps {
  viewportRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onDrop: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDragOver: (e: ReactDragEvent<HTMLDivElement>) => void;
  tabs: DocumentTab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onAddTab: () => void;
  hideTabBar?: boolean;
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
  onResetView: () => void;
  onResetRotation: () => void;
  canvasWidth: number;
  canvasHeight: number;
  activeTool?: string;
  brushSize?: number;
}

export default function DrawingCanvas({
  viewportRef,
  canvasRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDrop,
  onDragOver,
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onAddTab,
  hideTabBar = false,
  zoom,
  panX,
  panY,
  rotation,
  onResetView,
  onResetRotation,
  canvasWidth,
  canvasHeight,
  activeTool = "brush",
  brushSize = 8,
}: DrawingCanvasProps) {
  const isRotated = Math.round(rotation) !== 0 && Math.round(rotation) !== 360;
  const isZoomed = Math.abs(zoom - 1) > 0.05;

  const isBrushTool = activeTool === "brush" || activeTool === "eraser";
  const displayDiameter = Math.max(3, Math.round((brushSize ?? 8) * zoom));

  const cursorCircleRef = useRef<HTMLDivElement | null>(null);
  const activePointerCountRef = useRef(0);
  const isCursorVisibleRef = useRef(false);

  const updateCursorPosition = (clientX: number, clientY: number) => {
    if (!cursorCircleRef.current || !viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    cursorCircleRef.current.style.transform = `translate3d(calc(${x}px - 50%), calc(${y}px - 50%), 0)`;
  };

  const showCursor = (clientX: number, clientY: number) => {
    if (!cursorCircleRef.current || !isBrushTool) return;
    updateCursorPosition(clientX, clientY);
    cursorCircleRef.current.style.display = "block";
    isCursorVisibleRef.current = true;
  };

  const hideCursor = () => {
    if (!cursorCircleRef.current) return;
    cursorCircleRef.current.style.display = "none";
    isCursorVisibleRef.current = false;
  };

  useEffect(() => {
    if (!isBrushTool) {
      hideCursor();
    }
  }, [isBrushTool]);

  const handlePointerDownInternal = (e: ReactPointerEvent<HTMLDivElement>) => {
    activePointerCountRef.current++;
    if (isBrushTool) {
      if (activePointerCountRef.current === 1) {
        showCursor(e.clientX, e.clientY);
      } else {
        // Multi-touch gesture (e.g. 2 jari zoom/pan) -> sembunyikan kursor
        hideCursor();
      }
    }
    onPointerDown(e);
  };

  const handlePointerMoveInternal = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isBrushTool) {
      if (e.pointerType === "mouse") {
        if (!isCursorVisibleRef.current) {
          showCursor(e.clientX, e.clientY);
        } else {
          updateCursorPosition(e.clientX, e.clientY);
        }
      } else if (activePointerCountRef.current === 1) {
        updateCursorPosition(e.clientX, e.clientY);
      }
    }
    onPointerMove(e);
  };

  const handlePointerUpInternal = (e: ReactPointerEvent<HTMLDivElement>) => {
    activePointerCountRef.current = Math.max(0, activePointerCountRef.current - 1);
    if (e.pointerType !== "mouse" || activePointerCountRef.current === 0) {
      if (e.pointerType !== "mouse") {
        hideCursor();
      }
    }
    onPointerUp(e);
  };

  const handlePointerEnterInternal = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isBrushTool && e.pointerType === "mouse") {
      showCursor(e.clientX, e.clientY);
    }
  };

  const handlePointerLeaveInternal = () => {
    activePointerCountRef.current = 0;
    hideCursor();
  };

  return (
    <div className="w-full h-full min-w-0 min-h-0 flex flex-col select-none overflow-hidden">
      {!hideTabBar && (
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={onSelectTab}
          onCloseTab={onCloseTab}
          onAddTab={onAddTab}
        />
      )}

      {/* Main Viewport Container */}
      <div
        ref={viewportRef}
        className="relative flex-1 min-h-0 w-full overflow-hidden bg-neutral-950 touch-none select-none"
        style={{
          cursor: isBrushTool ? "none" : activeTool === "move" ? "grab" : "crosshair",
        }}
        onPointerDown={handlePointerDownInternal}
        onPointerMove={handlePointerMoveInternal}
        onPointerUp={handlePointerUpInternal}
        onPointerCancel={handlePointerUpInternal}
        onPointerEnter={handlePointerEnterInternal}
        onPointerLeave={handlePointerLeaveInternal}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        {/* Transform container for Canvas Paper */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            transform: `translate3d(calc(-50% + ${panX}px), calc(-50% + ${panY}px), 0) scale(${zoom}) rotate(${rotation}deg)`,
            transformOrigin: "center center",
            willChange: "transform",
          }}
          className="pointer-events-none"
        >
          <canvas
            ref={canvasRef}
            className="bg-white rounded-sm shadow-2xl block"
            style={{
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
            }}
          />
        </div>

        {/* Brush & Eraser Size Cursor Preview */}
        {isBrushTool && (
          <div
            ref={cursorCircleRef}
            className="pointer-events-none absolute z-50 rounded-full"
            style={{
              display: "none",
              top: 0,
              left: 0,
              width: `${displayDiameter}px`,
              height: `${displayDiameter}px`,
              border: "1px solid rgba(255, 255, 255, 0.95)",
              boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.75), inset 0 0 0 1px rgba(0, 0, 0, 0.25)",
              willChange: "transform",
              transform: "translate3d(-9999px, -9999px, 0)",
            }}
          >
            {/* Center crosshair dot for exact precision */}
            {displayDiameter >= 6 && (
              <div
                className="pointer-events-none absolute rounded-full"
                style={{
                  width: "2px",
                  height: "2px",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  backgroundColor: "#ffffff",
                  boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.85)",
                }}
              />
            )}
          </div>
        )}

        {/* HUD Badges for Rotation & Zoom Reset (Ibis Paint style) */}
        {(isRotated || isZoomed) && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20 pointer-events-auto">
            {isRotated && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResetRotation();
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-900/85 backdrop-blur border border-neutral-700 text-[11px] text-neutral-300 hover:text-white shadow-lg active:scale-95 transition-all cursor-pointer"
                title="Reset Rotasi (0°)"
              >
                <RotateCcw size={12} className="text-amber-400" />
                <span>{Math.round(((rotation % 360) + 360) % 360)}°</span>
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onResetView();
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-900/85 backdrop-blur border border-neutral-700 text-[11px] text-neutral-300 hover:text-white shadow-lg active:scale-95 transition-all cursor-pointer"
              title="Fit Kanvas ke Layar"
            >
              <Maximize2 size={12} className="text-sky-400" />
              <span>{Math.round(zoom * 100)}%</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}