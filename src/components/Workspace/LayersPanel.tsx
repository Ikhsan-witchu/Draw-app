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
}

export function LayersPanel({
  layers,
  activeLayerId,
  onAdd,
  onDelete,
  onToggleVisible,
  onToggleLock,
  onSelect,
  onReorder,
}: LayersPanelProps) {
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
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-0.5 px-1 py-0.5 border-b border-neutral-800 shrink-0">
        <button
          onClick={onAdd}
          title="Tambah layer"
          className="p-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
        >
          <Plus size={13} />
        </button>
        <button
          onClick={() => activeLayerId && onDelete(activeLayerId)}
          disabled={!activeLayerId || layers.length <= 1}
          title="Hapus layer"
          className="p-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto touch-pan-y">
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
            <div className="w-4 h-4 rounded-sm bg-white border border-neutral-700 shrink-0" />
            <span className="text-[11px] text-neutral-300 truncate">{layer.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}