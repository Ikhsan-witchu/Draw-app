import { Eye, EyeOff, Lock, Plus, Trash2, Unlock } from "lucide-react";
import type { DragEvent } from "react";
import type { LayerMeta } from "../../hooks/useDrawingCanvas";

interface LayersPanelProps {
  layers: LayerMeta[];
  activeLayerId: string | null;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onSelect: (id: string) => void;
  onReorder: (draggedId: string, targetId: string, position: "before" | "after") => void;
  onOpacityChange?: (id: string, opacity: number) => void;
  onBlendModeChange?: (id: string, blendMode: GlobalCompositeOperation) => void;
}

const BLEND_MODES: { label: string; value: GlobalCompositeOperation }[] = [
  { label: "Normal", value: "source-over" },
  { label: "Multiply", value: "multiply" },
  { label: "Screen", value: "screen" },
  { label: "Overlay", value: "overlay" },
  { label: "Darken", value: "darken" },
  { label: "Lighten", value: "lighten" },
  { label: "Color Dodge", value: "color-dodge" },
  { label: "Color Burn", value: "color-burn" },
  { label: "Hard Light", value: "hard-light" },
  { label: "Soft Light", value: "soft-light" },
  { label: "Difference", value: "difference" },
];

export function LayersPanel({
  layers,
  activeLayerId,
  onAdd,
  onDelete,
  onToggleVisible,
  onToggleLock,
  onSelect,
  onReorder,
  onOpacityChange,
  onBlendModeChange,
}: LayersPanelProps) {
  const activeLayer = layers.find((l) => l.id === activeLayerId);

  function handleDrop(e: DragEvent<HTMLDivElement>, targetId: string) {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === targetId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const position = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
    onReorder(draggedId, targetId, position);
  }

  return (
    <div className="h-full flex flex-col text-xs text-neutral-300 select-none">
      {/* Action bar */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-neutral-800 shrink-0 bg-neutral-900/60">
        <div className="flex items-center gap-1">
          <button
            onClick={onAdd}
            title="Tambah layer"
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => activeLayerId && onDelete(activeLayerId)}
            disabled={!activeLayerId || layers.length <= 1}
            title="Hapus layer"
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {activeLayer && onBlendModeChange && (
          <select
            value={activeLayer.blendMode ?? "source-over"}
            onChange={(e) => onBlendModeChange(activeLayer.id, e.target.value as GlobalCompositeOperation)}
            className="bg-neutral-800 text-[11px] text-neutral-200 rounded px-1.5 py-0.5 border border-neutral-700 outline-none cursor-pointer"
          >
            {BLEND_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Opacity slider for active layer */}
      {activeLayer && onOpacityChange && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-neutral-800/80 bg-neutral-900/40 text-[11px]">
          <span className="text-neutral-400 shrink-0">Opasitas</span>
          <input
            type="range"
            min={0}
            max={100}
            value={activeLayer.opacity ?? 100}
            onChange={(e) => onOpacityChange(activeLayer.id, Number(e.target.value))}
            className="w-full accent-white h-1 bg-neutral-800 rounded cursor-pointer"
          />
          <span className="text-neutral-300 font-mono text-[10px] w-7 text-right">
            {activeLayer.opacity ?? 100}%
          </span>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar touch-pan-y">
        {layers.map((layer) => (
          <div
            key={layer.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", layer.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => handleDrop(e, layer.id)}
            onClick={() => onSelect(layer.id)}
            className={`flex items-center gap-2 px-2 py-1.5 sm:py-0.5 cursor-pointer border-b border-neutral-800/60 ${
              activeLayerId === layer.id ? "bg-neutral-800" : "hover:bg-neutral-800/50"
            }`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisible(layer.id);
              }}
              title={layer.visible ? "Sembunyikan" : "Tampilkan"}
              className="text-neutral-400 hover:text-white shrink-0"
            >
              {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock(layer.id);
              }}
              title={layer.locked ? "Buka kunci layer" : "Kunci layer"}
              className={`shrink-0 ${layer.locked ? "text-amber-400 hover:text-amber-300" : "text-neutral-400 hover:text-white"}`}
            >
              {layer.locked ? <Lock size={11} /> : <Unlock size={11} />}
            </button>
            <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
              <span className="text-[11px] text-neutral-300 truncate">{layer.name}</span>
              {((layer.opacity !== undefined && layer.opacity < 100) || (layer.blendMode && layer.blendMode !== "source-over")) && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-neutral-700/60 text-neutral-400 shrink-0 font-mono">
                  {layer.opacity ?? 100}%{layer.blendMode && layer.blendMode !== "source-over" ? ` • ${layer.blendMode}` : ""}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}