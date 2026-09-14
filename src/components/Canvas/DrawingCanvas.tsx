import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

interface DrawingCanvasProps {
  viewportRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onPointerDown: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
}

export default function DrawingCanvas({
  viewportRef,
  canvasRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
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
          />
        </div>
      </div>
    </div>
  );
}