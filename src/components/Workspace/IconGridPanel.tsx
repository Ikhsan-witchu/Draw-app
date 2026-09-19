import { useContainerColumns } from "../../hooks/useContainerColumns";
import { ICON_ITEM_SIZE, ICON_GRID_GAP } from "./layoutConstants";
import type { ToolItem } from "./types";

interface IconGridPanelProps {
  items: ToolItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Override default item cell size (px). Falls back to ICON_ITEM_SIZE. */
  itemSize?: number;
  /** Override default icon render size (px). Falls back to 14. */
  iconSize?: number;
  /** Override default grid gap (px). Falls back to ICON_GRID_GAP. */
  gap?: number;
}

export function IconGridPanel({
  items,
  activeId,
  onSelect,
  itemSize = ICON_ITEM_SIZE,
  iconSize = 14,
  gap = ICON_GRID_GAP,
}: IconGridPanelProps) {
  const [gridRef, columns] = useContainerColumns<HTMLDivElement>(itemSize, gap);

  return (
    <div ref={gridRef} className="p-1 h-full overflow-y-auto">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, ${itemSize}px)`,
          gridAutoRows: `${itemSize}px`,
          gap: `${gap}px`,
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
            <Icon size={iconSize} />
          </button>
        ))}
      </div>
    </div>
  );
}