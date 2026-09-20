import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import DrawingCanvas from "../Canvas/DrawingCanvas";
import { useDrawingCanvas, type DocumentTab } from "../../hooks/useDrawingCanvas";
import { useIsMobile } from "../../hooks/useIsMobile";
import { IconGridPanel } from "./IconGridPanel";
import { MenuBar, type MenuDef } from "./MenuBar";
import { HuePanel } from "./HuePanel";
import { LayersPanel } from "./LayersPanel";
import { Sidebar } from "./Sidebar";
import { MobileTopBar, MobileBottomBar } from "./MobileToolbar";
import { BottomSheet } from "./BottomSheet";
import { BrushSizeControl } from "./BrushSizeControl";
import { PanelRenderer } from "./PanelRenderer";
import { ResizeSplitter } from "./ResizeSplitter";
import { TOOLS, BRUSHES } from "./toolsData";
import {
  widthForColumns,
  BRUSH_ITEM_SIZE,
  BRUSH_GRID_GAP,
  BRUSH_PANEL_PADDING,
} from "./layoutConstants";
import type { DockZone, DropPosition, PanelId } from "./types";
import NewImageDialog, { type DocumentSize } from "../Start/NewImageDialog";
import { loadActiveAppState, saveActiveAppState } from "../../utils/persistence";

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

function computeMinSidebarWidth(panelIds: PanelId[]): number {
  if (panelIds.length === 0) return 32;
  // Jika hanya panel tools, lebar minimum adalah 1 kolom pas (32px)
  if (panelIds.every((id) => id === "tools")) {
    return widthForColumns(1);
  }
  // Jika kombinasi tools dan brushes saja
  if (panelIds.every((id) => id === "tools" || id === "brushes")) {
    return panelIds.includes("brushes")
      ? widthForColumns(1, BRUSH_ITEM_SIZE, BRUSH_GRID_GAP, BRUSH_PANEL_PADDING)
      : widthForColumns(1);
  }
  // Jika ada color picker atau layers panel
  return 180;
}

function snapLeftWidth(raw: number, panelIds: PanelId[]): number {
  const minWidth = computeMinSidebarWidth(panelIds);
  if (raw <= minWidth) return minWidth;

  // Magnetic snapping ke kelipatan kolom jika panel kiri hanya tools
  if (panelIds.every((id) => id === "tools")) {
    const colSnapPoints = [
      widthForColumns(1), // 32px (1 col)
      widthForColumns(2), // 56px (2 cols)
      widthForColumns(3), // 80px (3 cols)
      widthForColumns(4), // 104px (4 cols)
    ];
    for (const point of colSnapPoints) {
      if (Math.abs(raw - point) <= 6) {
        return point;
      }
    }
  }

  return Math.min(400, Math.max(minWidth, raw));
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

  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = loadActiveAppState();
    return saved?.leftWidth ?? computeSidebarWidth(INITIAL_LEFT_PANELS);
  });
  const [rightWidth, setRightWidth] = useState(() => {
    const saved = loadActiveAppState();
    return saved?.rightWidth ?? computeSidebarWidth(INITIAL_RIGHT_PANELS);
  });
  const [bottomHeight, setBottomHeight] = useState(() => {
    const saved = loadActiveAppState();
    return saved?.bottomHeight ?? 140;
  });

  const [leftPanels, setLeftPanels] = useState<PanelId[]>(() => {
    const saved = loadActiveAppState();
    if (saved?.leftPanels && Array.isArray(saved.leftPanels) && saved.leftPanels.length > 0) {
      return saved.leftPanels as PanelId[];
    }
    return INITIAL_LEFT_PANELS;
  });
  const [rightPanels, setRightPanels] = useState<PanelId[]>(() => {
    const saved = loadActiveAppState();
    if (saved?.rightPanels && Array.isArray(saved.rightPanels) && saved.rightPanels.length > 0) {
      return saved.rightPanels as PanelId[];
    }
    return INITIAL_RIGHT_PANELS;
  });
  const [bottomPanels, setBottomPanels] = useState<PanelId[]>(() => {
    const saved = loadActiveAppState();
    if (saved?.bottomPanels && Array.isArray(saved.bottomPanels) && saved.bottomPanels.length > 0) {
      return saved.bottomPanels as PanelId[];
    }
    return ["layers"];
  });

  const [dragPanel, setDragPanel] = useState<PanelId | null>(null);
  const [dragOverZone, setDragOverZone] = useState<DockZone | null>(null);

  // Ingat zona terakhir tiap panel, supaya waktu di-centang lagi dia balik ke tempat semula
  const lastZoneRef = useRef<Partial<Record<PanelId, DockZone>>>({
    tools: "left",
    brushes: "right",
    hue: "right",
    layers: "bottom",
  });

  // State fungsional: tool aktif, warna (hue/sat/val), brush size
  const [activeTool, setActiveTool] = useState<string>(() => {
    const saved = loadActiveAppState();
    return saved?.activeTool ?? TOOLS[0]?.id ?? "brush";
  });
  const [activeBrush, setActiveBrush] = useState<string>(() => {
    const saved = loadActiveAppState();
    return saved?.activeBrush ?? BRUSHES[0]?.id ?? "pen";
  });
  const [brushSize, setBrushSize] = useState<number>(() => {
    const saved = loadActiveAppState();
    return saved?.brushSize ?? 8;
  });
  const [hue, setHue] = useState(() => {
    const saved = loadActiveAppState();
    return saved?.color?.hue ?? 200;
  });
  const [sat, setSat] = useState(() => {
    const saved = loadActiveAppState();
    return saved?.color?.sat ?? 70;
  });
  const [val, setVal] = useState(() => {
    const saved = loadActiveAppState();
    return saved?.color?.val ?? 85;
  });
  const color = `hsl(${hue}, ${sat}%, ${val}%)`;

  // Sinkronisasi tool, warna, dan layout panel ke persistence
  useEffect(() => {
    const current = loadActiveAppState();
    if (current) {
      saveActiveAppState({
        ...current,
        activeTool,
        activeBrush,
        brushSize,
        color: { hue, sat, val },
        leftWidth,
        rightWidth,
        bottomHeight,
        leftPanels,
        rightPanels,
        bottomPanels,
      });
    }
  }, [
    activeTool,
    activeBrush,
    brushSize,
    hue,
    sat,
    val,
    leftWidth,
    rightWidth,
    bottomHeight,
    leftPanels,
    rightPanels,
    bottomPanels,
  ]);

  const drawing = useDrawingCanvas({
    tool: activeTool,
    brushType: activeBrush,
    brushSize: brushSize,
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

  const [activeResizeZone, setActiveResizeZone] = useState<DockZone | null>(null);
  const resizingZone = useRef<DockZone | null>(null);
  const startPos = useRef(0);
  const startSize = useRef(0);

  function handleResizeMove(e: MouseEvent) {
    const zone = resizingZone.current;
    if (!zone) return;

    if (zone === "left") {
      const delta = e.clientX - startPos.current;
      setLeftWidth(snapLeftWidth(startSize.current + delta, leftPanels));
    } else if (zone === "right") {
      const delta = e.clientX - startPos.current;
      const minRight = computeMinSidebarWidth(rightPanels);
      setRightWidth(Math.min(450, Math.max(minRight, startSize.current - delta)));
    } else {
      const delta = e.clientY - startPos.current;
      setBottomHeight(Math.min(500, Math.max(64, startSize.current - delta)));
    }
  }

  function handleResizeEnd() {
    resizingZone.current = null;
    setActiveResizeZone(null);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", handleResizeMove);
    window.removeEventListener("mouseup", handleResizeEnd);
  }

  function handleResizeStart(zone: DockZone, e: ReactMouseEvent<HTMLDivElement>) {
    e.preventDefault();
    resizingZone.current = zone;
    setActiveResizeZone(zone);
    startPos.current = zone === "bottom" ? e.clientY : e.clientX;
    startSize.current = zone === "left" ? leftWidth : zone === "right" ? rightWidth : bottomHeight;
    document.body.style.cursor = zone === "bottom" ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeEnd);
  }

  function handleSplitterDoubleClick(zone: DockZone) {
    if (zone === "left") {
      if (leftPanels.every((id) => id === "tools")) {
        const c1 = widthForColumns(1);
        const c2 = widthForColumns(2);
        setLeftWidth((prev) => (Math.abs(prev - c1) < 4 ? c2 : c1));
      } else {
        setLeftWidth(computeSidebarWidth(leftPanels));
      }
    } else if (zone === "right") {
      setRightWidth(computeSidebarWidth(rightPanels));
    } else if (zone === "bottom") {
      setBottomHeight(140);
    }
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
    return (
      <PanelRenderer
        id={id}
        dragPanel={dragPanel}
        onDragStart={(e, panelId) => {
          e.dataTransfer.setData("text/plain", panelId);
          e.dataTransfer.effectAllowed = "move";
          setDragPanel(panelId);
        }}
        onDragEnd={() => setDragPanel(null)}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        activeBrush={activeBrush}
        onSelectBrush={setActiveBrush}
        hue={hue}
        sat={sat}
        val={val}
        onColorChange={(next) => {
          setHue(next.hue);
          setSat(next.sat);
          setVal(next.val);
        }}
        layers={drawing.layers}
        activeLayerId={drawing.activeLayerId}
        onAddLayer={drawing.addLayer}
        onDeleteLayer={drawing.deleteLayer}
        onToggleLayerVisible={drawing.toggleLayerVisibility}
        onToggleLayerLock={drawing.toggleLayerLock}
        onSelectLayer={drawing.selectLayer}
        onReorderLayer={drawing.reorderLayer}
      />
    );
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
      <div className="flex flex-col h-full h-dvh overflow-hidden bg-neutral-950 select-none">
        {/* Top bar at the top */}
        <MobileTopBar
          activeTool={activeTool}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
          onUndo={drawing.undo}
          onSave={() => drawing.exportImage()}
          onNewFile={() => setShowNewDialog(true)}
          onOpenFile={onOpenTabFile}
          onCloseTab={() => activeTabId && onCloseTab(activeTabId)}
          color={color}
          tabTitle={activeTab?.title ?? ""}
        />

        {/* Fullscreen canvas in the middle */}
        <div className="flex-1 min-h-0 relative">
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
            zoom={drawing.zoom}
            panX={drawing.panX}
            panY={drawing.panY}
            rotation={drawing.rotation}
            onResetView={drawing.resetView}
            onResetRotation={drawing.resetRotation}
            canvasWidth={drawing.canvasWidth}
            canvasHeight={drawing.canvasHeight}
          />
        </div>

        {/* Bottom toolbar at the bottom of the screen */}
        <MobileBottomBar
          tools={TOOLS}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          color={color}
          onToggleColor={() => setMobileColorOpen((p) => !p)}
          onToggleBrushes={() => setMobileBrushesOpen((p) => !p)}
          onToggleLayers={() => setMobileLayersOpen((p) => !p)}
          brushSize={brushSize}
        />

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
            {/* Quick Brush Size Slider inside Mobile Sheet */}
            <div className="mb-3.5 pb-3 border-b border-neutral-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-neutral-400 font-medium">Ukuran Brush</span>
                <span className="text-xs font-mono text-white bg-neutral-800 px-2 py-0.5 rounded">
                  {brushSize} px
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="flex-1 h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="w-8 h-8 rounded-full border border-neutral-700 flex items-center justify-center shrink-0 bg-neutral-950">
                  <div
                    className="rounded-full"
                    style={{
                      width: `${Math.min(Math.max(brushSize, 4), 28)}px`,
                      height: `${Math.min(Math.max(brushSize, 4), 28)}px`,
                      backgroundColor: activeTool === "eraser" ? "#e5e5e5" : color,
                    }}
                  />
                </div>
              </div>
            </div>

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
    <div className="flex flex-col h-full h-dvh overflow-hidden bg-neutral-950 select-none">
      {/* Top bar */}
      <div className="relative z-30 h-12 shrink-0 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between px-3">
        <MenuBar menus={[fileMenu, workspaceMenu]} />
        <div className="flex items-center gap-3">
          <BrushSizeControl
            size={brushSize}
            onChange={setBrushSize}
            color={color}
            isEraser={activeTool === "eraser"}
            compact={false}
          />
        </div>
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
        <ResizeSplitter
          zone="left"
          isResizing={activeResizeZone === "left"}
          onResizeStart={handleResizeStart}
          onDoubleClick={handleSplitterDoubleClick}
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
              zoom={drawing.zoom}
              panX={drawing.panX}
              panY={drawing.panY}
              rotation={drawing.rotation}
              onResetView={drawing.resetView}
              onResetRotation={drawing.resetRotation}
              canvasWidth={drawing.canvasWidth}
              canvasHeight={drawing.canvasHeight}
            />
          </div>

          <ResizeSplitter
            zone="bottom"
            isResizing={activeResizeZone === "bottom"}
            onResizeStart={handleResizeStart}
            onDoubleClick={handleSplitterDoubleClick}
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

        <ResizeSplitter
          zone="right"
          isResizing={activeResizeZone === "right"}
          onResizeStart={handleResizeStart}
          onDoubleClick={handleSplitterDoubleClick}
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