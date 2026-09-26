// ─── SelectionOverlay: Marching Ants untuk Selection Tools ──────────────────
// Menampilkan selection rectangle atau lasso path langsung di atas kanvas
// dengan koordinat dokumen asli (transformasi zoom/pan/rotasi ditangani oleh parent container).

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
  const display = getDisplaySelection(selState);
  if (!display) return null;

  const currentZoom = zoom > 0 ? zoom : 1;
  const sw = 1.5 / currentZoom;

  const dashStyle = {
    strokeDasharray: `${6 / currentZoom} ${4 / currentZoom}`,
    strokeDashoffset: -dashOffset / currentZoom,
    strokeWidth: sw,
    fill: "none",
  };

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-30"
      width={canvasWidth}
      height={canvasHeight}
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      style={{ overflow: "visible" }}
    >
      {display.mode === "rect" &&
        display.rectX !== undefined &&
        display.rectY !== undefined &&
        display.rectW !== undefined &&
        display.rectH !== undefined && (
          <g>
            {/* Outline shadow gelap */}
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
            {/* Garis putih marching ants */}
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

      {display.mode === "lasso" && display.points && display.points.length > 1 && (() => {
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
    </svg>
  );
}
