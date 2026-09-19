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
    <div className={`h-full flex flex-col @container ${dimmed ? "opacity-40" : ""}`}>
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title={title}
        className="flex items-center justify-center @[50px]:justify-start gap-1 px-1 py-0.5 text-[11px] text-neutral-500 hover:text-neutral-300 cursor-grab active:cursor-grabbing select-none border-b border-neutral-800 bg-neutral-900 min-w-0 overflow-hidden transition-colors"
      >
        <GripVertical size={11} className="shrink-0" />
        <span className="truncate hidden @[50px]:inline">{title}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto bg-neutral-900">{children}</div>
    </div>
  );
}