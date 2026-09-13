import type { DragEvent, ReactNode } from "react";
import type { DropPosition, PanelId, SidebarSide } from "./types";

interface SidebarProps {
  side: SidebarSide;
  width: number;
  panelIds: PanelId[];
  renderPanel: (id: PanelId) => ReactNode;
  onDropPanel: (side: SidebarSide, panelId: PanelId, position: DropPosition) => void;
  isDragOver: boolean;
  setDragOverSide: (side: SidebarSide | null) => void;
}

export function Sidebar({
  side,
  width,
  panelIds,
  renderPanel,
  onDropPanel,
  isDragOver,
  setDragOverSide,
}: SidebarProps) {
  return (
    <div
      className="relative flex flex-col bg-neutral-900 shrink-0"
      style={{ width }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOverSide(side);
      }}
      onDragLeave={() => setDragOverSide(null)}
      onDrop={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const panelId = e.dataTransfer.getData("text/plain") as PanelId;
        const rect = e.currentTarget.getBoundingClientRect();
        const position: DropPosition = e.clientY - rect.top < rect.height / 2 ? "start" : "end";
        onDropPanel(side, panelId, position);
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
        <div key={id} className="flex-1 min-h-0 border-t border-neutral-800 first:border-t-0">
          {renderPanel(id)}
        </div>
      ))}
    </div>
  );
}