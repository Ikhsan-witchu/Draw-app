import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import DrawingCanvas from "../Canvas/DrawingCanvas";
import { useDrawingCanvas, type DocumentTab } from "../../hooks/useDrawingCanvas";
import { IconGridPanel } from "./IconGridPanel";
import { MenuBar, type MenuDef } from "./MenuBar";
import { HuePanel } from "./HuePanel";
import { LayersPanel } from "./LayersPanel";
import { PanelShell } from "./PanelShell";
import { Sidebar } from "./Sidebar";
import { TOOLS, PENCILS } from "./toolsData";
import { widthForColumns } from "./layoutConstants";
import type { DockZone, DropPosition, PanelId } from "./types";
import NewImageDialog, { type DocumentSize } from "../Start/NewImageDialog";

// Lebar "pas" buat tiap jenis panel — dipakai buat nentuin lebar default sidebar
const PANEL_PREFERRED_WIDTH: Partial<Record<PanelId, number>> = {
  tools: widthForColumns(1), // sidebar isi tools: cukup 1 item per baris
  pencils: widthForColumns(3), // sidebar isi pencils: cukup 3 item per baris
  hue: 240,
  layers: 220,
};

function computeSidebarWidth(panelIds: PanelId[]): number {
  const widths = panelIds.map((id) => PANEL_PREFERRED_WIDTH[id] ?? 200);
  return widths.length > 0 ? Math.max(...widths) : 200;
}

const INITIAL_LEFT_PANELS: PanelId[] = ["tools"];
const INITIAL_RIGHT_PANELS: PanelId[] = ["hue", "pencils"];

interface DrawingWorkspaceProps {
  tabs: DocumentTab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: (size: DocumentSize) => void;
  onOpenTabFile: (file: File) => void;
}

export default function DrawingWorkspace({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onOpenTabFile,
}: DrawingWorkspaceProps) {
  const [leftWidth, setLeftWidth] = useState(() => computeSidebarWidth(INITIAL_LEFT_PANELS));
  const [rightWidth, setRightWidth] = useState(() => computeSidebarWidth(INITIAL_RIGHT_PANELS));
  const [bottomHeight, setBottomHeight] = useState(200);

  const [leftPanels, setLeftPanels] = useState<PanelId[]>(INITIAL_LEFT_PANELS);
  const [rightPanels, setRightPanels] = useState<PanelId[]>(INITIAL_RIGHT_PANELS);
  const [bottomPanels, setBottomPanels] = useState<PanelId[]>(["layers"]);

  const [dragPanel, setDragPanel] = useState<PanelId | null>(null);
  const [dragOverZone, setDragOverZone] = useState<DockZone | null>(null);

  // Ingat zona terakhir tiap panel, supaya waktu di-centang lagi dia balik ke tempat semula
  const lastZoneRef = useRef<Partial<Record<PanelId, DockZone>>>({
    tools: "left",
    pencils: "right",
    hue: "right",
    layers: "bottom",
  });

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
    tabs,
    activeTabId,
    onColorPick: (next) => {
      setHue(next.hue);
      setSat(next.sat);
      setVal(next.val);
    },
  });

  const [showNewDialog, setShowNewDialog] = useState(false);
  const openFileInputRef = useRef<HTMLInputElement | null>(null);

  function handleOpenFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onOpenTabFile(file);
    e.target.value = "";
  }

  const resizingZone = useRef<DockZone | null>(null);
  const startPos = useRef(0);
  const startSize = useRef(0);

  function handleResizeMove(e: MouseEvent) {
    const zone = resizingZone.current;
    if (!zone) return;

    if (zone === "left") {
      const delta = e.clientX - startPos.current;
      setLeftWidth(Math.min(400, Math.max(64, startSize.current + delta)));
    } else if (zone === "right") {
      const delta = e.clientX - startPos.current;
      setRightWidth(Math.min(400, Math.max(64, startSize.current - delta)));
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
    lastZoneRef.current[panelId] = zone;
  }

  function isPanelVisible(id: PanelId): boolean {
    return leftPanels.includes(id) || rightPanels.includes(id) || bottomPanels.includes(id);
  }

  function togglePanelVisibility(id: PanelId) {
    if (isPanelVisible(id)) {
      // Sembunyikan: hapus dari zona manapun dia berada sekarang, ingat zona itu
      if (leftPanels.includes(id)) {
        lastZoneRef.current[id] = "left";
        setLeftPanels((prev) => prev.filter((p) => p !== id));
      } else if (rightPanels.includes(id)) {
        lastZoneRef.current[id] = "right";
        setRightPanels((prev) => prev.filter((p) => p !== id));
      } else if (bottomPanels.includes(id)) {
        lastZoneRef.current[id] = "bottom";
        setBottomPanels((prev) => prev.filter((p) => p !== id));
      }
    } else {
      // Tampilkan lagi: taruh di zona terakhir dia berada
      const zone = lastZoneRef.current[id] ?? "right";
      if (zone === "left") setLeftPanels((prev) => [id, ...prev]);
      else if (zone === "right") setRightPanels((prev) => [id, ...prev]);
      else setBottomPanels((prev) => [id, ...prev]);
    }
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
            onToggleLock={drawing.toggleLayerLock}
            onSelect={drawing.selectLayer}
            onReorder={drawing.reorderLayer}
          />
        </PanelShell>
      );
    }
    return null;
  }

  const fileMenu: MenuDef = {
    label: "File",
    items: [
      { type: "action", label: "New", onClick: () => setShowNewDialog(true) },
      { type: "action", label: "Open", onClick: () => openFileInputRef.current?.click() },
      { type: "action", label: "Save", shortcut: "Ctrl+S", onClick: () => drawing.exportImage() },
      { type: "action", label: "Close", onClick: () => activeTabId && onCloseTab(activeTabId) },
    ],
  };

  const workspaceMenu: MenuDef = {
    label: "Workspace",
    items: [
      { type: "checkbox", label: "Tools", checked: isPanelVisible("tools"), onToggle: () => togglePanelVisibility("tools") },
      {
        type: "checkbox",
        label: "Pencils",
        checked: isPanelVisible("pencils"),
        onToggle: () => togglePanelVisibility("pencils"),
      },
      { type: "checkbox", label: "Hue", checked: isPanelVisible("hue"), onToggle: () => togglePanelVisibility("hue") },
      {
        type: "checkbox",
        label: "Layers",
        checked: isPanelVisible("layers"),
        onToggle: () => togglePanelVisibility("layers"),
      },
    ],
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-neutral-950 select-none">
      {/* Top bar */}
      <div className="h-12 shrink-0 bg-neutral-900 border-b border-neutral-800">
        <MenuBar menus={[fileMenu, workspaceMenu]} />
      </div>

      <input
        ref={openFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleOpenFileChange}
      />

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
              onDrop={drawing.handleDrop}
              onDragOver={drawing.handleDragOver}
              tabs={tabs}
              activeTabId={activeTabId}
              onSelectTab={onSelectTab}
              onCloseTab={onCloseTab}
              onAddTab={() => setShowNewDialog(true)}
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

      {showNewDialog && (
        <NewImageDialog
          onCreate={(size) => {
            setShowNewDialog(false);
            onNewTab(size);
          }}
          onCancel={() => setShowNewDialog(false)}
        />
      )}
    </div>
  );
}