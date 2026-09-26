import {
  Eye,
  EyeOff,
  Lock,
  Plus,
  Trash2,
  Unlock,
  CornerDownRight,
  Shield,
} from "lucide-react";
import type { DragEvent } from "react";
import type { LayerMeta } from "../../hooks/useDrawingCanvas";

interface LayersPanelProps {
  layers: LayerMeta[];
  activeLayerId: string | null;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onToggleClipped?: (id: string) => void;
  onToggleAlphaLock?: (id: string) => void;
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
  onToggleClipped,
  onToggleAlphaLock,
  onSelect,
  onReorder,
  onOpacityChange,
  onBlendModeChange,
}: LayersPanelProps) {
  const activeLayerIndex = layers.findIndex((l) => l.id === activeLayerId);
  const activeLayer = activeLayerIndex !== -1 ? layers[activeLayerIndex] : undefined;
  const isBottomLayer = activeLayerIndex === layers.length - 1;

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

          {/* Quick toggle Kliping Mask untuk active layer */}
          {activeLayer && onToggleClipped && !isBottomLayer && (
            <button
              onClick={() => onToggleClipped(activeLayer.id)}
              title={
                activeLayer.clipped
                  ? "Lepas Kliping Mask (Masking ke layer bawah)"
                  : "Aktifkan Kliping Mask (Masking ke layer bawah)"
              }
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border ${
                activeLayer.clipped
                  ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/50"
                  : "bg-neutral-800 text-neutral-400 hover:text-white border-neutral-700/60"
              }`}
            >
              <CornerDownRight size={11} className={activeLayer.clipped ? "text-indigo-400" : ""} />
              <span>Kliping</span>
            </button>
          )}

          {/* Quick toggle Alpha Lock untuk active layer */}
          {activeLayer && onToggleAlphaLock && (
            <button
              onClick={() => onToggleAlphaLock(activeLayer.id)}
              title={
                activeLayer.alphaLocked
                  ? "Buka Kunci Transparansi (Alpha Lock)"
                  : "Kunci Transparansi (Alpha Lock - cat hanya di area bergambar)"
              }
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border ${
                activeLayer.alphaLocked
                  ? "bg-amber-600/30 text-amber-300 border-amber-500/50"
                  : "bg-neutral-800 text-neutral-400 hover:text-white border-neutral-700/60"
              }`}
            >
              <Shield size={10} className={activeLayer.alphaLocked ? "text-amber-400" : ""} />
              <span>α-Lock</span>
            </button>
          )}
        </div>

        {activeLayer && onBlendModeChange && (
          <select
            value={activeLayer.blendMode ?? "source-over"}
            onChange={(e) =>
              onBlendModeChange(activeLayer.id, e.target.value as GlobalCompositeOperation)
            }
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

      {/* Layer List */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar touch-pan-y">
        {layers.map((layer, index) => {
          const isCurrentBottom = index === layers.length - 1;
          const isSelected = activeLayerId === layer.id;

          return (
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
              className={`flex items-center gap-1.5 px-2 py-1.5 sm:py-0.5 cursor-pointer border-b border-neutral-800/60 transition-colors ${
                isSelected ? "bg-neutral-800" : "hover:bg-neutral-800/50"
              }`}
            >
              {/* Visibility button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisible(layer.id);
                }}
                title={layer.visible ? "Sembunyikan" : "Tampilkan"}
                className="text-neutral-400 hover:text-white shrink-0 p-0.5"
              >
                {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>

              {/* Lock button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLock(layer.id);
                }}
                title={layer.locked ? "Buka kunci layer" : "Kunci layer"}
                className={`shrink-0 p-0.5 ${
                  layer.locked ? "text-amber-400 hover:text-amber-300" : "text-neutral-400 hover:text-white"
                }`}
              >
                {layer.locked ? <Lock size={11} /> : <Unlock size={11} />}
              </button>

              {/* Kliping Mask Toggle per layer */}
              {onToggleClipped && !isCurrentBottom && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleClipped(layer.id);
                  }}
                  title={
                    layer.clipped
                      ? "Lepas Kliping Mask (Masking ke layer bawah)"
                      : "Kliping Mask (Masking ke layer bawah)"
                  }
                  className={`shrink-0 p-0.5 transition-colors ${
                    layer.clipped
                      ? "text-indigo-400 hover:text-indigo-300"
                      : "text-neutral-600 hover:text-neutral-300"
                  }`}
                >
                  <CornerDownRight size={11} />
                </button>
              )}

              {/* Alpha Lock Toggle per layer */}
              {onToggleAlphaLock && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleAlphaLock(layer.id);
                  }}
                  title={
                    layer.alphaLocked
                      ? "Buka Kunci Transparansi"
                      : "Kunci Transparansi (Alpha Lock)"
                  }
                  className={`shrink-0 p-0.5 transition-colors ${
                    layer.alphaLocked
                      ? "text-amber-400 hover:text-amber-300"
                      : "text-neutral-600 hover:text-neutral-300"
                  }`}
                >
                  <Shield size={10} />
                </button>
              )}

              {/* Layer Title & Indent if Clipped */}
              <div
                className={`flex-1 min-w-0 flex items-center justify-between gap-1 ${
                  layer.clipped ? "pl-2 border-l-2 border-indigo-500/70" : ""
                }`}
              >
                <div className="flex items-center gap-1 min-w-0">
                  {layer.clipped && (
                    <span className="text-[10px] text-indigo-400 font-mono shrink-0">↳</span>
                  )}
                  <span
                    className={`text-[11px] truncate ${
                      layer.clipped ? "text-indigo-200" : "text-neutral-300"
                    }`}
                  >
                    {layer.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {layer.clipped && (
                    <span className="text-[8px] px-1 py-0.2 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/40">
                      Mask
                    </span>
                  )}
                  {layer.alphaLocked && (
                    <span className="text-[8px] px-1 py-0.2 rounded bg-amber-900/60 text-amber-300 border border-amber-700/40">
                      α
                    </span>
                  )}
                  {((layer.opacity !== undefined && layer.opacity < 100) ||
                    (layer.blendMode && layer.blendMode !== "source-over")) && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-neutral-700/60 text-neutral-400 font-mono">
                      {layer.opacity ?? 100}%
                      {layer.blendMode && layer.blendMode !== "source-over"
                        ? ` • ${layer.blendMode}`
                        : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}