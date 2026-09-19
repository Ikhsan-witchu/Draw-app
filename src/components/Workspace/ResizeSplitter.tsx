// ─── Komponen resize splitter dockable yang mulus & taktil ───────────────────

import type { MouseEvent as ReactMouseEvent } from "react";
import type { DockZone } from "./types";

interface ResizeSplitterProps {
  zone: DockZone;
  isResizing: boolean;
  onResizeStart: (zone: DockZone, e: ReactMouseEvent<HTMLDivElement>) => void;
  onDoubleClick?: (zone: DockZone) => void;
}

export function ResizeSplitter({
  zone,
  isResizing,
  onResizeStart,
  onDoubleClick,
}: ResizeSplitterProps) {
  const isVertical = zone === "left" || zone === "right";

  if (isVertical) {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={(e) => onResizeStart(zone, e)}
        onDoubleClick={() => onDoubleClick?.(zone)}
        className="relative w-2.5 -mx-1 cursor-col-resize flex items-center justify-center select-none group z-20 shrink-0"
        title="Drag untuk mengubah ukuran, klik dua kali untuk snap"
      >
        {/* Garis pemisah visual */}
        <div
          className={`w-[1px] h-full transition-colors duration-150 ${
            isResizing
              ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
              : "bg-neutral-800 group-hover:bg-neutral-500"
          }`}
        />

        {/* Indikator taktil (grip pill) */}
        <div
          className={`absolute w-1 h-7 rounded-full transition-all duration-150 pointer-events-none ${
            isResizing
              ? "bg-blue-400 opacity-100 scale-y-110"
              : "bg-neutral-600 opacity-0 group-hover:opacity-100 group-hover:bg-neutral-400"
          }`}
        />
      </div>
    );
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      onMouseDown={(e) => onResizeStart(zone, e)}
      onDoubleClick={() => onDoubleClick?.(zone)}
      className="relative h-2.5 -my-1 cursor-row-resize flex items-center justify-center select-none group z-20 shrink-0"
      title="Drag untuk mengubah ukuran, klik dua kali untuk snap"
    >
      {/* Garis pemisah visual */}
      <div
        className={`h-[1px] w-full transition-colors duration-150 ${
          isResizing
            ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
            : "bg-neutral-800 group-hover:bg-neutral-500"
        }`}
      />

      {/* Indikator taktil (grip pill) */}
      <div
        className={`absolute h-1 w-7 rounded-full transition-all duration-150 pointer-events-none ${
          isResizing
            ? "bg-blue-400 opacity-100 scale-x-110"
            : "bg-neutral-600 opacity-0 group-hover:opacity-100 group-hover:bg-neutral-400"
        }`}
      />
    </div>
  );
}
