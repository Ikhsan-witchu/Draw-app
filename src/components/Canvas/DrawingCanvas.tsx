import { useDrawingCanvas } from "../../hooks/useDrawingCanvas";

interface DrawingCanvasProps {
  tool: string;
  color: string;
}

export default function DrawingCanvas({ tool, color }: DrawingCanvasProps) {
  const { containerRef, canvasRef, handlePointerDown, handlePointerMove, handlePointerUp } =
    useDrawingCanvas({ tool, color });

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        className="bg-white rounded-sm shadow-2xl touch-none block"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
}
