import {
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import DrawingCanvas from "../Canvas/DrawingCanvas";
import { IconGridPanel } from "./IconGridPanel";
import { HuePanel } from "./HuePanel";
import { PanelShell } from "./PanelShell";
import { Sidebar } from "./Sidebar";
import { TOOLS, PENCILS } from "./toolsData";
import type { DropPosition, PanelId, SidebarSide } from "./types";

export default function DrawingWorkspace() {
  const [leftWidth, setLeftWidth] = useState(220);
  const [rightWidth, setRightWidth] = useState(240);
  const [leftPanels, setLeftPanels] = useState<PanelId[]>(["tools"]);
  const [rightPanels, setRightPanels] = useState<PanelId[]>(["hue", "pencils"]);
  const [dragPanel, setDragPanel] = useState<PanelId | null>(null);
  const [dragOverSide, setDragOverSide] = useState<SidebarSide | null>(null);

  // State fungsional: tool aktif, warna (hue/sat/val)
  const [activeTool, setActiveTool] = useState<string>(TOOLS[0]?.id ?? "brush");
  const [activePencil, setActivePencil] = useState<string>(PENCILS[0]?.id ?? "pen"); // visual-only dulu
  const [hue, setHue] = useState(200);
  const [sat, setSat] = useState(70);
  const [val, setVal] = useState(85);
  const color = `hsl(${hue}, ${sat}%, ${val}%)`;

  const resizingSide = useRef<SidebarSide | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

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

  function handleResizeStart(side: SidebarSide) {
    return (e: ReactMouseEvent<HTMLDivElement>) => {
      resizingSide.current = side;
      startX.current = e.clientX;
      startWidth.current = side === "left" ? leftWidth : rightWidth;
      window.addEventListener("mousemove", handleResizeMove);
      window.addEventListener("mouseup", handleResizeEnd);
    };
  }

  function handleDropPanel(side: SidebarSide, panelId: PanelId, position: DropPosition) {
    if (!panelId) return;
    const withoutPanel = (arr: PanelId[]) => arr.filter((p) => p !== panelId);
    let nextLeft = withoutPanel(leftPanels);
    let nextRight = withoutPanel(rightPanels);
    const target = side === "left" ? nextLeft : nextRight;
    const inserted = position === "start" ? [panelId, ...target] : [...target, panelId];
    if (side === "left") nextLeft = inserted;
    else nextRight = inserted;
    setLeftPanels(nextLeft);
    setRightPanels(nextRight);
    setDragOverSide(null);
    setDragPanel(null);
  }

  function renderPanel(id: PanelId) {
    const common = {
      dimmed: dragPanel === id,
      onDragStart: (e: DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "move";
        setDragPanel(id);
      },
      onDragEnd: () => setDragPanel(null),
    };

    if (id === "tools") {
      return (
        <PanelShell title="Tools" {...common}>
          <IconGridPanel items={TOOLS} activeId={activeTool} onSelect={setActiveTool} />
        </PanelShell>
      );
    }
    if (id === "pencils") {
      return (
        <PanelShell title="Pencils" {...common}>
          <IconGridPanel items={PENCILS} activeId={activePencil} onSelect={setActivePencil} />
        </PanelShell>
      );
    }
    if (id === "hue") {
      return (
        <PanelShell title="Color" {...common}>
          <HuePanel
            hue={hue}
            sat={sat}
            val={val}
            onChange={(next) => {
              setHue(next.hue);
              setSat(next.sat);
              setVal(next.val);
            }}
          />
        </PanelShell>
      );
    }
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-950 select-none">
      {/* Top bar — sengaja dikosongkan dulu, isinya belum ditentukan */}
      <div className="h-12 shrink-0 bg-neutral-900 border-b border-neutral-800" />

      <div className="flex flex-1 min-h-0">
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
          onMouseDown={handleResizeStart("left")}
          className="w-1 cursor-col-resize bg-neutral-800 hover:bg-neutral-600 shrink-0"
        />

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full h-full max-w-4xl">
            <DrawingCanvas tool={activeTool} color={color} />
          </div>
        </div>

        <div
          onMouseDown={handleResizeStart("right")}
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
    </div>
  );
}
