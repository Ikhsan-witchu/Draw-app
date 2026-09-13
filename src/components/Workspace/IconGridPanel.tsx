import { useContainerColumns } from "../../hooks/useContainerColumns";
import type { ToolItem } from "./types";

interface IconGridPanelProps {
  items: ToolItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function IconGridPanel({ items, activeId, onSelect }: IconGridPanelProps) {
  const [gridRef, columns] = useContainerColumns<HTMLDivElement>(52);

  return (
    <div ref={gridRef} className="p-3 h-full overflow-y-auto">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {items.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => onSelect(id)}
            className={`aspect-square flex items-center justify-center rounded-md transition-colors ${
              activeId === id
                ? "bg-white text-neutral-900"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}
