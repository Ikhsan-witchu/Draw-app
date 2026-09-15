import { X } from "lucide-react";
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";

interface DrawingCanvasProps {
  viewportRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onPointerDown: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  onDrop: (e: ReactDragEvent<HTMLCanvasElement>) => void;
  onDragOver: (e: ReactDragEvent<HTMLCanvasElement>) => void;
  onClose: () => void;
}

export default function DrawingCanvas({
  viewportRef,
  canvasRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDrop,
  onDragOver,
  onClose,
}: DrawingCanvasProps) {
  return (
    <div className="relative w-full h-full min-w-0 min-h-0">
      <div ref={viewportRef} className="w-full h-full overflow-auto">
        <div className="min-w-full min-h-full flex items-center justify-center p-6">
          <canvas
            ref={canvasRef}
            className="bg-white rounded-sm shadow-2xl touch-none block"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onDrop={onDrop}
            onDragOver={onDragOver}
          />
        </div>
      </div>

      <button
        onClick={onClose}
        title="Tutup kanvas"
        className="absolute top-3 right-3 z-20 p-1.5 rounded-md bg-neutral-900/90 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}