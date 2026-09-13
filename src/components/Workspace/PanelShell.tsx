import { GripVertical } from "lucide-react";
import type { DragEvent, ReactNode } from "react";

interface PanelShellProps {
  title: string;
  dimmed: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  children: ReactNode;
}

export function PanelShell({ title, dimmed, onDragStart, onDragEnd, children }: PanelShellProps) {
  return (
    <div className={`h-full flex flex-col ${dimmed ? "opacity-40" : ""}`}>
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-500 cursor-grab active:cursor-grabbing select-none border-b border-neutral-800 bg-neutral-900"
      >
        <GripVertical size={14} />
        <span>{title}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto bg-neutral-900">{children}</div>
    </div>
  );
}