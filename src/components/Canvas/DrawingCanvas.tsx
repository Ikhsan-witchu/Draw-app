import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";
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
}: DrawingCanvasProps) {
  const isRotated = Math.round(rotation) !== 0 && Math.round(rotation) !== 360;
  const isZoomed = Math.abs(zoom - 1) > 0.05;

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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
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

        {/* HUD Badges for Rotation & Zoom Reset (Ibis Paint style) */}
        {(isRotated || isZoomed) && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20 pointer-events-auto">
            {isRotated && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResetRotation();
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-900/85 backdrop-blur border border-neutral-700 text-[11px] text-neutral-300 hover:text-white shadow-lg active:scale-95 transition-all"
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
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-900/85 backdrop-blur border border-neutral-700 text-[11px] text-neutral-300 hover:text-white shadow-lg active:scale-95 transition-all"
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