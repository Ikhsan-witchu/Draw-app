// ─── SelectionOverlay: Marching Ants untuk Selection Tools ──────────────────
// Menampilkan selection rectangle atau lasso path langsung di atas kanvas
// dengan koordinat dokumen asli (transformasi zoom/pan/rotasi ditangani oleh parent container).

import { useEffect, useRef } from "react";
import type { SelectionState } from "../../hooks/useSelectionTool";

interface SelectionOverlayProps {
  selState: SelectionState;
  dashOffset: number;
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
}

function getDisplaySelection(selState: SelectionState): {
  mode: "rect" | "lasso";
  rectX?: number;
  rectY?: number;
  rectW?: number;
  rectH?: number;
  points?: { x: number; y: number }[];
} | null {
  if (selState.drawing) {
    if (selState.dragStart && selState.dragCurrent) {
      if (selState.lassoPoints.length > 1) {
        return { mode: "lasso", points: selState.lassoPoints };
      }
      const { x: x1, y: y1 } = selState.dragStart;
      const { x: x2, y: y2 } = selState.dragCurrent;
      return {
        mode: "rect",
        rectX: Math.min(x1, x2),
        rectY: Math.min(y1, y2),
        rectW: Math.abs(x2 - x1),
        rectH: Math.abs(y2 - y1),
      };
    }
  }

  if (selState.active && selState.selection) {
    if (selState.selection.mode === "rect") {
      const { x, y, w, h } = selState.selection;
      return { mode: "rect", rectX: x, rectY: y, rectW: w, rectH: h };
    } else {
      return { mode: "lasso", points: selState.selection.points };
    }
  }

  return null;
}

export function SelectionOverlay({
  selState,
  dashOffset,
  canvasWidth,
  canvasHeight,
  zoom,
}: SelectionOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const display = getDisplaySelection(selState);
  
  // Menangani tampilan floating canvas saat mode move aktif
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Bersihkan container jika tidak sedang move
    if (!selState.move.active || !selState.move.floatingCanvas) {
      if (containerRef.current.firstChild) {
        containerRef.current.innerHTML = "";
      }
      return;
    }
    
    // Masukkan canvas jika belum ada
    if (containerRef.current.firstChild !== selState.move.floatingCanvas) {
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(selState.move.floatingCanvas);
    }
    
    // Perbarui posisi
    const canvas = selState.move.floatingCanvas;
    canvas.style.position = "absolute";
    canvas.style.left = `${Math.round(selState.move.currentX)}px`;
    canvas.style.top = `${Math.round(selState.move.currentY)}px`;
    canvas.style.pointerEvents = "none";
    canvas.style.transformOrigin = "top left";
    
  }, [selState.move]);

  if (!display && !selState.move.active) return null;

  const currentZoom = zoom > 0 ? zoom : 1;
  const sw = 1.5 / currentZoom;

  const dashStyle = {
    strokeDasharray: `${6 / currentZoom} ${4 / currentZoom}`,
    strokeDashoffset: -dashOffset / currentZoom,
    strokeWidth: sw,
    fill: "none",
  };
  
  // Jika sedang move, kita geser outline seleksi mengikuti currentX dan currentY
  let dx = 0;
  let dy = 0;
  if (selState.move.active) {
    dx = selState.move.currentX - selState.move.originX;
    dy = selState.move.currentY - selState.move.originY;
  }

  return (
    <>
      <div 
        ref={containerRef} 
        className="absolute inset-0 pointer-events-none z-30" 
        style={{ width: canvasWidth, height: canvasHeight, overflow: "visible" }}
      />
      <svg
        className="absolute inset-0 pointer-events-none z-30"
        width={canvasWidth}
        height={canvasHeight}
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        style={{ overflow: "visible" }}
      >
        {/* Transform group untuk outline seleksi yang ikut tergeser saat move */}
        <g transform={`translate(${dx}, ${dy})`}>
          {display && display.mode === "rect" &&
            display.rectX !== undefined &&
            display.rectY !== undefined &&
            display.rectW !== undefined &&
            display.rectH !== undefined && (
              <g>
                <rect
                  x={display.rectX}
                  y={display.rectY}
                  width={display.rectW}
                  height={display.rectH}
                  stroke="rgba(0,0,0,0.6)"
                  strokeDasharray={`${6 / currentZoom} ${4 / currentZoom}`}
                  strokeDashoffset={-dashOffset / currentZoom}
                  strokeWidth={sw * 2}
                  fill="rgba(99,102,241,0.06)"
                />
                <rect
                  x={display.rectX}
                  y={display.rectY}
                  width={display.rectW}
                  height={display.rectH}
                  stroke="rgba(255,255,255,0.95)"
                  {...dashStyle}
                />
              </g>
            )}

          {display && display.mode === "lasso" && display.points && display.points.length > 1 && (() => {
            const d =
              display.points
                .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
                .join(" ") + (selState.active ? " Z" : "");

            return (
              <g>
                <path
                  d={d}
                  stroke="rgba(0,0,0,0.6)"
                  strokeDasharray={`${6 / currentZoom} ${4 / currentZoom}`}
                  strokeDashoffset={-dashOffset / currentZoom}
                  strokeWidth={sw * 2}
                  fill="rgba(99,102,241,0.06)"
                />
                <path
                  d={d}
                  stroke="rgba(255,255,255,0.95)"
                  {...dashStyle}
                />
              </g>
            );
          })()}
        </g>
      </svg>
    </>
  );
}
