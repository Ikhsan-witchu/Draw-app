import React, { useRef, useState, useEffect } from "react";
import {
  GripVertical,
  Pencil,
  Eraser,
  PaintBucket,
  Lasso,
  Square,
  Move,
  Pipette,
  Type,
  PenTool,
  Paintbrush,
  Paintbrush2,
  Feather,
  Highlighter,
  type LucideIcon,
} from "lucide-react";

// Types Definition
export interface ToolItem {
  id: string;
  icon: LucideIcon;
  label: string;
}

export type Side = "left" | "right";
export type DropPosition = "start" | "end";

interface IconGridPanelProps {
  items: ToolItem[];
}

interface PanelShellProps {
  title: string;
  dimmed?: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  children: React.ReactNode;
}

interface SidebarProps {
  side: Side;
  width: number;
  panelIds: string[];
  renderPanel: (id: string) => React.ReactNode;
  onDropPanel: (side: Side, panelId: string, position: DropPosition) => void;
  isDragOver: boolean;
  setDragOverSide: (side: Side | null) => void;
}

const TOOLS: ToolItem[] = [
  { id: "brush", icon: Pencil, label: "Brush" },
  { id: "eraser", icon: Eraser, label: "Eraser" },
  { id: "bucket", icon: PaintBucket, label: "Fill" },
  { id: "lasso", icon: Lasso, label: "Lasso select" },
  { id: "rect", icon: Square, label: "Rectangle select" },
  { id: "move", icon: Move, label: "Move" },
  { id: "eyedropper", icon: Pipette, label: "Eyedropper" },
  { id: "text", icon: Type, label: "Text" },
];

const PENCILS: ToolItem[] = [
  { id: "pen", icon: PenTool, label: "Pen" },
  { id: "round", icon: Paintbrush, label: "Round brush" },
  { id: "flat", icon: Paintbrush2, label: "Flat brush" },
  { id: "feather", icon: Feather, label: "Airbrush" },
  { id: "marker", icon: Highlighter, label: "Marker" },
  { id: "pencil2", icon: Pencil, label: "Pencil" },
];

function useContainerColumns(
  minItemWidth: number
): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState<number>(3);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      setColumns(Math.max(1, Math.floor(width / minItemWidth)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [minItemWidth]);

  return [ref, columns];
}

function IconGridPanel({ items }: IconGridPanelProps) {
  const [gridRef, columns] = useContainerColumns(52);
  const [active, setActive] = useState<string>(items[0]?.id ?? "");

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
            onClick={() => setActive(id)}
            className={`aspect-square flex items-center justify-center rounded-md transition-colors ${
              active === id
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

function HuePanel() {
  const svRef = useRef<HTMLDivElement | null>(null);
  const draggingSv = useRef<boolean>(false);
  const [hue, setHue] = useState<number>(200);
  const [sat, setSat] = useState<number>(70);
  const [val, setVal] = useState<number>(85);

  function updateSv(clientX: number, clientY: number) {
    if (!svRef.current) return;
    const rect = svRef.current.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, clientX - rect.left));
    const y = Math.min(rect.height, Math.max(0, clientY - rect.top));
    setSat(Math.round((x / rect.width) * 100));
    setVal(Math.round(100 - (y / rect.height) * 100));
  }

  function handleSvDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingSv.current = true;
    updateSv(e.clientX, e.clientY);
  }

  function handleSvMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingSv.current) return;
    updateSv(e.clientX, e.clientY);
  }

  const currentColor = `hsl(${hue}, ${sat}%, ${val}%)`;

  return (
    <div className="p-3 flex flex-col gap-3 h-full">
      <div
        ref={svRef}
        onPointerDown={handleSvDown}
        onPointerMove={handleSvMove}
        onPointerUp={() => (draggingSv.current = false)}
        className="w-full aspect-square rounded-md relative cursor-crosshair shrink-0"
        style={{
          backgroundColor: `hsl(${hue}, 100%, 50%)`,
          backgroundImage:
            "linear-gradient(to top, #000000, rgba(0,0,0,0)), linear-gradient(to right, #ffffff, rgba(255,255,255,0))",
        }}
      >
        <div
          className="absolute w-3 h-3 rounded-full border-2 border-white shadow pointer-events-none"
          style={{
            left: `${sat}%`,
            top: `${100 - val}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={360}
        value={hue}
        onChange={(e) => setHue(Number(e.target.value))}
        className="w-full accent-white shrink-0"
      />

      <div className="flex items-center gap-2 shrink-0">
        <div
          className="w-8 h-8 rounded-md border border-neutral-700 shrink-0"
          style={{ backgroundColor: currentColor }}
        />
        <span className="text-xs text-neutral-500 truncate">
          {currentColor}
        </span>
      </div>
    </div>
  );
}

function PanelShell({
  title,
  dimmed,
  onDragStart,
  onDragEnd,
  children,
}: PanelShellProps) {
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
      <div className="flex-1 min-h-0 overflow-y-auto bg-neutral-900">
        {children}
      </div>
    </div>
  );
}

function Sidebar({
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
      onDrop={(e) => {
        e.preventDefault();
        const panelId = e.dataTransfer.getData("text/plain");
        const rect = e.currentTarget.getBoundingClientRect();
        const position: DropPosition =
          e.clientY - rect.top < rect.height / 2 ? "start" : "end";
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
        <div
          key={id}
          className="flex-1 min-h-0 border-t border-neutral-800 first:border-t-0"
        >
          {renderPanel(id)}
        </div>
      ))}
    </div>
  );
}

export default function DrawingWorkspaceDemo() {
  const [leftWidth, setLeftWidth] = useState<number>(220);
  const [rightWidth, setRightWidth] = useState<number>(240);
  const [leftPanels, setLeftPanels] = useState<string[]>(["tools"]);
  const [rightPanels, setRightPanels] = useState<string[]>(["hue", "pencils"]);
  const [dragPanel, setDragPanel] = useState<string | null>(null);
  const [dragOverSide, setDragOverSide] = useState<Side | null>(null);

  const resizingSide = useRef<Side | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  function handleResizeMove(e: MouseEvent) {
    const side = resizingSide.current;
    if (!side) return;
    const delta = e.clientX - startX.current;
    if (side === "left") {
      setLeftWidth(Math.min(360, Math.max(72, startWidth.current + delta)));
    } else {
      setRightWidth(Math.min(360, Math.max(72, startWidth.current - delta)));
    }
  }

  function handleResizeEnd() {
    resizingSide.current = null;
    window.removeEventListener("mousemove", handleResizeMove);
    window.removeEventListener("mouseup", handleResizeEnd);
  }

  function handleResizeStart(side: Side, e: React.MouseEvent<HTMLDivElement>) {
    resizingSide.current = side;
    startX.current = e.clientX;
    startWidth.current = side === "left" ? leftWidth : rightWidth;
    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeEnd);
  }

  function handleDropPanel(side: Side, panelId: string, position: DropPosition) {
    if (!panelId) return;
    const withoutPanel = (arr: string[]) => arr.filter((p) => p !== panelId);
    let nextLeft = withoutPanel(leftPanels);
    let nextRight = withoutPanel(rightPanels);
    const target = side === "left" ? nextLeft : nextRight;
    const inserted =
      position === "start" ? [panelId, ...target] : [...target, panelId];

    if (side === "left") nextLeft = inserted;
    else nextRight = inserted;

    setLeftPanels(nextLeft);
    setRightPanels(nextRight);
    setDragOverSide(null);
    setDragPanel(null);
  }

  function renderPanel(id: string): React.ReactNode {
    const common = {
      dimmed: dragPanel === id,
      onDragStart: (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "move";
        setDragPanel(id);
      },
      onDragEnd: () => setDragPanel(null),
    };

    if (id === "tools") {
      return (
        <PanelShell title="Tools" {...common}>
          <IconGridPanel items={TOOLS} />
        </PanelShell>
      );
    }
    if (id === "pencils") {
      return (
        <PanelShell title="Pencils" {...common}>
          <IconGridPanel items={PENCILS} />
        </PanelShell>
      );
    }
    if (id === "hue") {
      return (
        <PanelShell title="Color" {...common}>
          <HuePanel />
        </PanelShell>
      );
    }
    return null;
  }

  return (
    <div className="flex h-screen bg-neutral-950 select-none">
      <Sidebar
        side="left"
        width={leftWidth}
        panelIds={leftPanels}
        renderPanel={renderPanel}
        onDropPanel={handleDropPanel}
        isDragOver={dragOverSide === "left"}
        setDragOverSide={setDragOverSide}
      />
      <div
        onMouseDown={(e) => handleResizeStart("left", e)}
        className="w-1 cursor-col-resize bg-neutral-800 hover:bg-neutral-600 shrink-0"
      />

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full h-full max-w-4xl bg-white rounded-sm shadow-2xl" />
      </div>

      <div
        onMouseDown={(e) => handleResizeStart("right", e)}
        className="w-1 cursor-col-resize bg-neutral-800 hover:bg-neutral-600 shrink-0"
      />
      <Sidebar
        side="right"
        width={rightWidth}
        panelIds={rightPanels}
        renderPanel={renderPanel}
        onDropPanel={handleDropPanel}
        isDragOver={dragOverSide === "right"}
        setDragOverSide={setDragOverSide}
      />
    </div>
  );
}