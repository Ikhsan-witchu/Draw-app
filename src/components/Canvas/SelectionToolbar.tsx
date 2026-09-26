// ─── SelectionToolbar: Toolbar floating di pojok selection ──────────────────
// Menampilkan tombol Cut, Copy, Fill, Clear di dekat pojok kanan-bawah selection.

import { Scissors, Copy, PaintBucket, X } from "lucide-react";
import type { SelectionState } from "../../hooks/useSelectionTool";

interface SelectionToolbarProps {
  selState: SelectionState;
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
  canvasWidth: number;
  canvasHeight: number;
  onCut: () => void;
  onCopy: () => void;
  onFill: () => void;
  onClear: () => void;
}

export function SelectionToolbar({
  selState,
  zoom,
  panX,
  panY,
  rotation,
  canvasWidth,
  canvasHeight,
  onCut,
  onCopy,
  onFill,
  onClear,
}: SelectionToolbarProps) {
  if (!selState.active || !selState.selection) return null;

  // Hitung pojok kanan-bawah selection
  let anchorDocX: number;
  let anchorDocY: number;

  if (selState.selection.mode === "rect") {
    const { x, y, w, h } = selState.selection;
    anchorDocX = x + w;
    anchorDocY = y + h;
  } else {
    const { points } = selState.selection;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    anchorDocX = Math.max(...xs);
    anchorDocY = Math.max(...ys);
  }

  const offsetX = (anchorDocX - canvasWidth / 2) * zoom;
  const offsetY = (anchorDocY - canvasHeight / 2) * zoom;
  const rad = (rotation * Math.PI) / 180;
  const rotX = offsetX * Math.cos(rad) - offsetY * Math.sin(rad);
  const rotY = offsetX * Math.sin(rad) + offsetY * Math.cos(rad);

  const leftStyle = `calc(50% + ${panX + rotX + 8}px)`;
  const topStyle = `calc(50% + ${panY + rotY + 8}px)`;

  const btnClass =
    "flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-white transition-colors hover:bg-neutral-700 active:scale-95";

  return (
    <div
      className="absolute z-40 pointer-events-auto flex items-center gap-0.5 bg-neutral-900/95 backdrop-blur border border-neutral-700 rounded-lg shadow-xl px-1 py-0.5"
      style={{ left: leftStyle, top: topStyle }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <button className={btnClass} title="Potong (Cut)" onClick={onCut}>
        <Scissors size={12} className="text-rose-400" />
        <span>Cut</span>
      </button>
      <div className="w-px h-4 bg-neutral-700" />
      <button className={btnClass} title="Salin (Copy)" onClick={onCopy}>
        <Copy size={12} className="text-sky-400" />
        <span>Copy</span>
      </button>
      <div className="w-px h-4 bg-neutral-700" />
      <button className={btnClass} title="Isi warna" onClick={onFill}>
        <PaintBucket size={12} className="text-amber-400" />
        <span>Fill</span>
      </button>
      <div className="w-px h-4 bg-neutral-700" />
      <button
        className="p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors active:scale-95"
        title="Batalkan seleksi (Esc)"
        onClick={onClear}
      >
        <X size={13} />
      </button>
    </div>
  );
}
