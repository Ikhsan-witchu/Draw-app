import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import DrawingCanvas from "../Canvas/DrawingCanvas";
import { useDrawingCanvas, type DocumentTab } from "../../hooks/useDrawingCanvas";
import { useIsMobile } from "../../hooks/useIsMobile";
import { IconGridPanel } from "./IconGridPanel";
import { MenuBar, type MenuDef } from "./MenuBar";
import { HuePanel } from "./HuePanel";
import { LayersPanel } from "./LayersPanel";
import { PanelShell } from "./PanelShell";
import { Sidebar } from "./Sidebar";
import { MobileToolbar } from "./MobileToolbar";
import { BottomSheet } from "./BottomSheet";
import { TOOLS, BRUSHES } from "./toolsData";
import {
  widthForColumns,
  BRUSH_ITEM_SIZE,
  BRUSH_GRID_GAP,
  BRUSH_PANEL_PADDING,
} from "./layoutConstants";
import type { DockZone, DropPosition, PanelId } from "./types";
import NewImageDialog, { type DocumentSize } from "../Start/NewImageDialog";

// Lebar "pas" buat tiap jenis panel — dipakai buat nentuin lebar default sidebar
const PANEL_PREFERRED_WIDTH: Partial<Record<PanelId, number>> = {
  tools: widthForColumns(1),
  brushes: widthForColumns(3, BRUSH_ITEM_SIZE, BRUSH_GRID_GAP, BRUSH_PANEL_PADDING),
  hue: 240,
  layers: 220,
};

function computeSidebarWidth(panelIds: PanelId[]): number {
  const widths = panelIds.map((id) => PANEL_PREFERRED_WIDTH[id] ?? 200);
  return widths.length > 0 ? Math.max(...widths) : 200;
}

const INITIAL_LEFT_PANELS: PanelId[] = ["tools"];
const INITIAL_RIGHT_PANELS: PanelId[] = ["hue", "brushes"];

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
  const isMobile = useIsMobile();

  const [leftWidth, setLeftWidth] = useState(() => computeSidebarWidth(INITIAL_LEFT_PANELS));
  const [rightWidth, setRightWidth] = useState(() => computeSidebarWidth(INITIAL_RIGHT_PANELS));
  const [bottomHeight, setBottomHeight] = useState(140);

  const [leftPanels, setLeftPanels] = useState<PanelId[]>(INITIAL_LEFT_PANELS);
  const [rightPanels, setRightPanels] = useState<PanelId[]>(INITIAL_RIGHT_PANELS);
  const [bottomPanels, setBottomPanels] = useState<PanelId[]>(["layers"]);

  const [dragPanel, setDragPanel] = useState<PanelId | null>(null);
  const [dragOverZone, setDragOverZone] = useState<DockZone | null>(null);

  // Ingat zona terakhir tiap panel, supaya waktu di-centang lagi dia balik ke tempat semula
  const lastZoneRef = useRef<Partial<Record<PanelId, DockZone>>>({
    tools: "left",
    brushes: "right",
    hue: "right",
    layers: "bottom",
  });

  // State fungsional: tool aktif, warna (hue/sat/val)
  const [activeTool, setActiveTool] = useState<string>(TOOLS[0]?.id ?? "brush");
  const [activeBrush, setActiveBrush] = useState<string>(BRUSHES[0]?.id ?? "pen");
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

  // Mobile bottom sheets
  const [mobileColorOpen, setMobileColorOpen] = useState(false);
  const [mobileBrushesOpen, setMobileBrushesOpen] = useState(false);
  const [mobileLayersOpen, setMobileLayersOpen] = useState(false);

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
    if (id === "brushes") {
      return (
        <PanelShell title="Brush Palette" {...common}>
          <IconGridPanel
            items={BRUSHES}
            activeId={activeBrush}
            onSelect={setActiveBrush}
            itemSize={BRUSH_ITEM_SIZE}
            iconSize={18}
            gap={BRUSH_GRID_GAP}
          />
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

  // ── Desktop menu definitions ──
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
        label: "Brush Palette",
        checked: isPanelVisible("brushes"),
        onToggle: () => togglePanelVisibility("brushes"),
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

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // ════════════════════════════════════════
  // ── MOBILE LAYOUT ──
  // ════════════════════════════════════════
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-neutral-950 select-none">
        <MobileToolbar
          tools={TOOLS}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          onUndo={drawing.undo}
          onSave={() => drawing.exportImage()}
          onNewFile={() => setShowNewDialog(true)}
          onOpenFile={onOpenTabFile}
          onCloseTab={() => activeTabId && onCloseTab(activeTabId)}
          color={color}
          onToggleColor={() => setMobileColorOpen((p) => !p)}
          onToggleBrushes={() => setMobileBrushesOpen((p) => !p)}
          onToggleLayers={() => setMobileLayersOpen((p) => !p)}
          tabTitle={activeTab?.title ?? ""}
        />

        {/* Fullscreen canvas */}
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
            hideTabBar
          />
        </div>

        {/* Bottom sheets for panels */}
        <BottomSheet title="Color" open={mobileColorOpen} onClose={() => setMobileColorOpen(false)}>
          <div className="h-72">
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
          </div>
        </BottomSheet>

        <BottomSheet
          title="Brush Palette"
          open={mobileBrushesOpen}
          onClose={() => setMobileBrushesOpen(false)}
        >
          <div className="p-3">
            <IconGridPanel
              items={BRUSHES}
              activeId={activeBrush}
              onSelect={(id) => {
                setActiveBrush(id);
                setMobileBrushesOpen(false);
              }}
              itemSize={BRUSH_ITEM_SIZE}
              iconSize={18}
              gap={BRUSH_GRID_GAP}
            />
          </div>
        </BottomSheet>

        <BottomSheet title="Layers" open={mobileLayersOpen} onClose={() => setMobileLayersOpen(false)}>
          <div className="min-h-[200px]">
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
          </div>
        </BottomSheet>

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

  // ════════════════════════════════════════
  // ── DESKTOP LAYOUT ──
  // ════════════════════════════════════════
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