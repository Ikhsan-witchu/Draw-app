import { useContainerColumns } from "../../hooks/useContainerColumns";
import { ICON_ITEM_SIZE, ICON_GRID_GAP } from "./layoutConstants";
import type { ToolItem } from "./types";

interface IconGridPanelProps {
  items: ToolItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function IconGridPanel({ items, activeId, onSelect }: IconGridPanelProps) {
  const [gridRef, columns] = useContainerColumns<HTMLDivElement>(ICON_ITEM_SIZE, ICON_GRID_GAP);

  return (
    <div ref={gridRef} className="p-1 h-full overflow-y-auto">
      <div
        className="grid gap-0.5"
        style={{
          gridTemplateColumns: `repeat(${columns}, ${ICON_ITEM_SIZE}px)`,
          gridAutoRows: `${ICON_ITEM_SIZE}px`,
        }}
      >
        {items.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => onSelect(id)}
            className={`flex items-center justify-center rounded transition-colors ${
              activeId === id
                ? "bg-white text-neutral-900"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>
    </div>
  );
}