import type { DragEvent, ReactNode } from "react";
import type { DockZone, DropPosition, PanelId } from "./types";

interface SidebarProps {
  zone: DockZone;
  orientation: "vertical" | "horizontal";
  size: number; // width (px) untuk vertical, height (px) untuk horizontal
  panelIds: PanelId[];
  renderPanel: (id: PanelId) => ReactNode;
  onDropPanel: (zone: DockZone, panelId: PanelId, position: DropPosition) => void;
  isDragOver: boolean;
  setDragOverZone: (zone: DockZone | null) => void;
}

export function Sidebar({
  zone,
  orientation,
  size,
  panelIds,
  renderPanel,
  onDropPanel,
  isDragOver,
  setDragOverZone,
}: SidebarProps) {
  const isVertical = orientation === "vertical";

  return (
    <div
      className={`relative flex bg-neutral-900 shrink-0 overflow-hidden ${isVertical ? "flex-col" : "flex-row"}`}
      style={isVertical ? { width: size } : { height: size }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOverZone(zone);
      }}
      onDragLeave={() => setDragOverZone(null)}
      onDrop={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const panelId = e.dataTransfer.getData("text/plain") as PanelId;
        const rect = e.currentTarget.getBoundingClientRect();
        const position: DropPosition = isVertical
          ? e.clientY - rect.top < rect.height / 2
            ? "start"
            : "end"
          : e.clientX - rect.left < rect.width / 2
            ? "start"
            : "end";
        onDropPanel(zone, panelId, position);
      }}
    >
      {isDragOver && (
        <div
          className="absolute inset-0 border-2 border-dashed border-neutral-600 pointer-events-none z-10"
          style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
        />
      )}
      {panelIds.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-xs text-neutral-600">
          Drop panel here
        </div>
      )}
      {panelIds.map((id) => (
        <div
          key={id}
          className={`flex-1 min-h-0 min-w-0 ${
            isVertical
              ? "border-t border-neutral-800 first:border-t-0"
              : "border-l border-neutral-800 first:border-l-0"
          }`}
        >
          {renderPanel(id)}
        </div>
      ))}
    </div>
  );
}