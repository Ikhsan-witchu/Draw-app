import {
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import DrawingCanvas from "../Canvas/DrawingCanvas";
import { useDrawingCanvas } from "../../hooks/useDrawingCanvas";
import { IconGridPanel } from "./IconGridPanel";
import { HuePanel } from "./HuePanel";
import { LayersPanel } from "./LayersPanel";
import { PanelShell } from "./PanelShell";
import { Sidebar } from "./Sidebar";
import { TOOLS, PENCILS } from "./toolsData";
import type { DockZone, DropPosition, PanelId } from "./types";

interface DrawingWorkspaceProps {
  documentWidth: number;
  documentHeight: number;
}

export default function DrawingWorkspace({ documentWidth, documentHeight }: DrawingWorkspaceProps) {
  const [leftWidth, setLeftWidth] = useState(220);
  const [rightWidth, setRightWidth] = useState(240);
  const [bottomHeight, setBottomHeight] = useState(200);

  const [leftPanels, setLeftPanels] = useState<PanelId[]>(["tools"]);
  const [rightPanels, setRightPanels] = useState<PanelId[]>(["hue", "pencils"]);
  const [bottomPanels, setBottomPanels] = useState<PanelId[]>(["layers"]);

  const [dragPanel, setDragPanel] = useState<PanelId | null>(null);
  const [dragOverZone, setDragOverZone] = useState<DockZone | null>(null);

  // State fungsional: tool aktif, warna (hue/sat/val)
  const [activeTool, setActiveTool] = useState<string>(TOOLS[0]?.id ?? "brush");
  const [activePencil, setActivePencil] = useState<string>(PENCILS[0]?.id ?? "pen"); // visual-only dulu
  const [hue, setHue] = useState(200);
  const [sat, setSat] = useState(70);
  const [val, setVal] = useState(85);
  const color = `hsl(${hue}, ${sat}%, ${val}%)`;

  const drawing = useDrawingCanvas({
    tool: activeTool,
    color,
    documentWidth,
    documentHeight,
    onColorPick: (next) => {
      setHue(next.hue);
      setSat(next.sat);
      setVal(next.val);
    },
  });

  const resizingZone = useRef<DockZone | null>(null);
  const startPos = useRef(0);
  const startSize = useRef(0);

  function handleResizeMove(e: MouseEvent) {
    const zone = resizingZone.current;
    if (!zone) return;

    if (zone === "left") {
      const delta = e.clientX - startPos.current;
      setLeftWidth(Math.min(360, Math.max(72, startSize.current + delta)));
    } else if (zone === "right") {
      const delta = e.clientX - startPos.current;
      setRightWidth(Math.min(360, Math.max(72, startSize.current - delta)));
    } else {
      const delta = e.clientY - startPos.current;
      setBottomHeight(Math.min(500, Math.max(80, startSize.current - delta)));
    }
  }

  function handleResizeEnd() {
    resizingZone.current = null;
    window.removeEventListener("mousemove", handleResizeMove);
    window.removeEventListener("mouseup", handleResizeEnd);
  }

  function handleResizeStart(zone: DockZone) {
    return (e: ReactMouseEvent<HTMLDivElement>) => {
      resizingZone.current = zone;
      startPos.current = zone === "bottom" ? e.clientY : e.clientX;
      startSize.current = zone === "left" ? leftWidth : zone === "right" ? rightWidth : bottomHeight;
      window.addEventListener("mousemove", handleResizeMove);
      window.addEventListener("mouseup", handleResizeEnd);
    };
  }

  function handleDropPanel(zone: DockZone, panelId: PanelId, position: DropPosition) {
    if (!panelId) return;
    const withoutPanel = (arr: PanelId[]) => arr.filter((p) => p !== panelId);

    let nextLeft = withoutPanel(leftPanels);
    let nextRight = withoutPanel(rightPanels);
    let nextBottom = withoutPanel(bottomPanels);

    const target = zone === "left" ? nextLeft : zone === "right" ? nextRight : nextBottom;
    const inserted = position === "start" ? [panelId, ...target] : [...target, panelId];

    if (zone === "left") nextLeft = inserted;
    else if (zone === "right") nextRight = inserted;
    else nextBottom = inserted;

    setLeftPanels(nextLeft);
    setRightPanels(nextRight);
    setBottomPanels(nextBottom);
    setDragOverZone(null);
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
    if (id === "layers") {
      return (
        <PanelShell title="Layers" {...common}>
          <LayersPanel
            layers={drawing.layers}
            activeLayerId={drawing.activeLayerId}
            onAdd={drawing.addLayer}
            onDelete={drawing.deleteLayer}
            onToggleVisible={drawing.toggleLayerVisibility}
            onSelect={drawing.selectLayer}
            onReorder={drawing.reorderLayer}
          />
        </PanelShell>
      );
    }
    return null;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-neutral-950 select-none">
      {/* Top bar — sengaja dikosongkan dulu, isinya belum ditentukan */}
      <div className="h-12 shrink-0 bg-neutral-900 border-b border-neutral-800" />

      <div className="flex flex-1 min-h-0">
        <Sidebar
          zone="left"
          orientation="vertical"
          size={leftWidth}
          panelIds={leftPanels}
          renderPanel={renderPanel}
          onDropPanel={handleDropPanel}
          isDragOver={dragOverZone === "left"}
          setDragOverZone={setDragOverZone}
        />
        <div
          onMouseDown={handleResizeStart("left")}
          className="w-1 cursor-col-resize bg-neutral-800 hover:bg-neutral-600 shrink-0"
        />

        {/* Kolom tengah: kanvas di atas, bottom bar di bawah */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0">
            <DrawingCanvas
              viewportRef={drawing.viewportRef}
              canvasRef={drawing.canvasRef}
              onPointerDown={drawing.handlePointerDown}
              onPointerMove={drawing.handlePointerMove}
              onPointerUp={drawing.handlePointerUp}
            />
          </div>

          <div
            onMouseDown={handleResizeStart("bottom")}
            className="h-1 cursor-row-resize bg-neutral-800 hover:bg-neutral-600 shrink-0"
          />
          <Sidebar
            zone="bottom"
            orientation="horizontal"
            size={bottomHeight}
            panelIds={bottomPanels}
            renderPanel={renderPanel}
            onDropPanel={handleDropPanel}
            isDragOver={dragOverZone === "bottom"}
            setDragOverZone={setDragOverZone}
          />
        </div>

        <div
          onMouseDown={handleResizeStart("right")}
          className="w-1 cursor-col-resize bg-neutral-800 hover:bg-neutral-600 shrink-0"
        />
        <Sidebar
          zone="right"
          orientation="vertical"
          size={rightWidth}
          panelIds={rightPanels}
          renderPanel={renderPanel}
          onDropPanel={handleDropPanel}
          isDragOver={dragOverZone === "right"}
          setDragOverZone={setDragOverZone}
        />
      </div>
    </div>
  );
}