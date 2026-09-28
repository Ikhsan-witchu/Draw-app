import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
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
import { BrushOpacityControl } from "./BrushOpacityControl";
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
import { Sparkles, Undo2, Redo2 } from "lucide-react";
import { AIAssistantPanel } from "../AI/AIAssistantPanel";
import type { WorkspaceToolSetters } from "../../utils/aiToolBridge";
import { hsvToRgbString } from "../../utils/canvasUtils";
import { SaveDialog } from "./SaveDialog";
import { ReferenceWindow } from "./ReferenceWindow";



// Lebar "pas" buat tiap jenis panel — dipakai buat nentuin lebar default sidebar
const PANEL_PREFERRED_WIDTH: Partial<Record<PanelId, number>> = {
  tools: widthForColumns(1),
  brushes: widthForColumns(3, BRUSH_ITEM_SIZE, BRUSH_GRID_GAP, BRUSH_PANEL_PADDING),
  brushSettings: 200,
  hue: 240,
  layers: 220,
  timeline: 220,
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
    return ["layers", "timeline"];
  });

  const [dragPanel, setDragPanel] = useState<PanelId | null>(null);
  const [dragOverZone, setDragOverZone] = useState<DockZone | null>(null);

  // Ingat zona terakhir tiap panel, supaya waktu di-centang lagi dia balik ke tempat semula
  const lastZoneRef = useRef<Partial<Record<PanelId, DockZone>>>({
    tools: "left",
    brushes: "right",
    hue: "right",
    layers: "bottom",
    timeline: "bottom",
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
  const [brushOpacity, setBrushOpacity] = useState<number>(() => {
    const saved = loadActiveAppState();
    return saved?.brushOpacity ?? 100;
  });
  const [stabilizerStrength, setStabilizerStrength] = useState<number>(() => {
    const saved = loadActiveAppState();
    return saved?.stabilizerStrength ?? 3;
  });
  const [shapeFilled, setShapeFilled] = useState<boolean>(() => {
    const saved = loadActiveAppState();
    return saved?.shapeFilled ?? false;
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
  const color = useMemo(() => hsvToRgbString(hue, sat, val), [hue, sat, val]);

  // Sinkronisasi tool, warna, dan layout panel ke persistence (didebounce 300ms agar resize/slider smooth)
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = loadActiveAppState();
      if (current) {
        saveActiveAppState({
          ...current,
          activeTool,
          activeBrush,
          brushSize,
          brushOpacity,
          stabilizerStrength,
          shapeFilled,
          color: { hue, sat, val },
          leftWidth,
          rightWidth,
          bottomHeight,
          leftPanels,
          rightPanels,
          bottomPanels,
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    activeTool,
    activeBrush,
    brushSize,
    brushOpacity,
    stabilizerStrength,
    shapeFilled,
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

  const handleColorPick = useCallback((next: { hue: number; sat: number; val: number }) => {
    setHue(next.hue);
    setSat(next.sat);
    setVal(next.val);
  }, []);

  const drawing = useDrawingCanvas({
    tool: activeTool,
    brushType: activeBrush,
    brushSize: brushSize,
    brushOpacity,
    stabilizerStrength,
    shapeFilled,
    color,
    tabs,
    activeTabId,
    onColorPick: handleColorPick,
  });

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showReferenceWindow, setShowReferenceWindow] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const openFileInputRef = useRef<HTMLInputElement | null>(null);
  const dwpFileInputRef = useRef<HTMLInputElement | null>(null);

  // Keyboard shortcuts (Save & Tools)
  useEffect(() => {
    function handleWorkspaceShortcuts(e: KeyboardEvent) {
      const isMod = e.ctrlKey || e.metaKey;
      const isInputField =
        (e.target as HTMLElement)?.tagName === "INPUT" ||
        (e.target as HTMLElement)?.tagName === "TEXTAREA" ||
        (e.target as HTMLElement)?.tagName === "SELECT";

      if (isMod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setShowSaveDialog(true);
        return;
      }

      // Jangan trigger shortcut tool jika user sedang mengetik di input text
      if (isInputField || isMod) return;

      const key = e.key.toLowerCase();

      // Tool selection shortcuts
      switch (key) {
        case "b": setActiveTool("brush"); break;
        case "e": setActiveTool("eraser"); break;
        case "l": setActiveTool("line"); break;
        case "u": setActiveTool("rectShape"); break;
        case "g": setActiveTool("bucket"); break;
        case "i": setActiveTool("eyedropper"); break;
        case "v": setActiveTool("move"); break;
        case "m": setActiveTool("rect"); break;
        case "w": setActiveTool("lasso"); break;
        case "t": setActiveTool("text"); break;
      }

      // Brush size & opacity shortcuts
      // Perhatikan bahwa Shift + [ menghasilkan '{' pada beberapa keyboard, dan Shift + ] menghasilkan '}'
      if (key === "[" || key === "{") {
        if (e.shiftKey) {
          setBrushOpacity((p) => Math.max(1, p - 10));
        } else {
          setBrushSize((p) => Math.max(1, p - (p > 10 ? 5 : 1)));
        }
      } else if (key === "]" || key === "}") {
        if (e.shiftKey) {
          setBrushOpacity((p) => Math.min(100, p + 10));
        } else {
          setBrushSize((p) => Math.min(500, p + (p >= 10 ? 5 : 1))); // Max 500px
        }
      }
    }
    window.addEventListener("keydown", handleWorkspaceShortcuts);
    return () => window.removeEventListener("keydown", handleWorkspaceShortcuts);
  }, []);

  const toolSetters = useMemo<WorkspaceToolSetters>(
    () => ({
      setActiveTool,
      setActiveBrush,
      setBrushSize,
      setBrushOpacity,
      handleColorPick,
    }),
    [handleColorPick],
  );

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

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, panelId: PanelId) => {
    e.dataTransfer.setData("text/plain", panelId);
    e.dataTransfer.effectAllowed = "move";
    setDragPanel(panelId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragPanel(null);
  }, []);

  const renderPanel = useCallback((id: PanelId) => {
    return (
      <PanelRenderer
        id={id}
        dragPanel={dragPanel}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        activeBrush={activeBrush}
        onSelectBrush={setActiveBrush}
        brushOpacity={brushOpacity}
        onBrushOpacityChange={setBrushOpacity}
        stabilizerStrength={stabilizerStrength}
        onStabilizerStrengthChange={setStabilizerStrength}
        shapeFilled={shapeFilled}
        onShapeFilledChange={setShapeFilled}
        hue={hue}
        sat={sat}
        val={val}
        onColorChange={handleColorPick}
        textFontSize={drawing.textTool.fontSize}
        onTextFontSizeChange={drawing.textTool.setFontSize}
        textFontFamily={drawing.textTool.fontFamily}
        onTextFontFamilyChange={drawing.textTool.setFontFamily}
        textIsBold={drawing.textTool.isBold}
        onTextToggleBold={() => drawing.textTool.setIsBold((b) => !b)}
        textIsItalic={drawing.textTool.isItalic}
        onTextToggleItalic={() => drawing.textTool.setIsItalic((i) => !i)}
        textAlign={drawing.textTool.align}
        onTextAlignChange={drawing.textTool.setAlign}
        frames={drawing.timeline.frames}
        currentFrameIndex={drawing.timeline.currentFrameIndex}
        fps={drawing.timeline.fps}
        isPlaying={drawing.timeline.isPlaying}
        isLooping={drawing.timeline.isLooping}
        onionSkinEnabled={drawing.timeline.onionSkinEnabled}
        canvasWidth={drawing.canvasWidth}
        canvasHeight={drawing.canvasHeight}
        onSelectFrame={drawing.timeline.selectFrame}
        onAddFrame={drawing.timeline.addFrame}
        onDuplicateFrame={drawing.timeline.duplicateFrame}
        onDeleteFrame={drawing.timeline.deleteFrame}
        onNextFrame={drawing.timeline.nextFrame}
        onPrevFrame={drawing.timeline.prevFrame}
        onFirstFrame={drawing.timeline.firstFrame}
        onLastFrame={drawing.timeline.lastFrame}
        onTogglePlay={drawing.timeline.togglePlay}
        onToggleLoop={() => drawing.timeline.setIsLooping((l) => !l)}
        onToggleOnionSkin={drawing.timeline.toggleOnionSkin}
        onFpsChange={drawing.timeline.setFps}
        layers={drawing.layers}
        activeLayerId={drawing.activeLayerId}
        onAddLayer={drawing.addLayer}
        onDeleteLayer={drawing.deleteLayer}
        onToggleLayerVisible={drawing.toggleLayerVisibility}
        onToggleLayerLock={drawing.toggleLayerLock}
        onToggleLayerClipped={drawing.toggleLayerClipped}
        onToggleLayerAlphaLock={drawing.toggleLayerAlphaLock}
        onSelectLayer={drawing.selectLayer}
        onReorderLayer={drawing.reorderLayer}
        onLayerOpacityChange={drawing.setLayerOpacity}
        onLayerBlendModeChange={drawing.setLayerBlendMode}
      />
    );
  }, [
    dragPanel,
    handleDragStart,
    handleDragEnd,
    activeTool,
    activeBrush,
    brushOpacity,
    stabilizerStrength,
    shapeFilled,
    hue,
    sat,
    val,
    handleColorPick,
    drawing.textTool.fontSize,
    drawing.textTool.fontFamily,
    drawing.textTool.isBold,
    drawing.textTool.isItalic,
    drawing.textTool.align,
    drawing.textTool.setFontSize,
    drawing.textTool.setFontFamily,
    drawing.textTool.setIsBold,
    drawing.textTool.setIsItalic,
    drawing.textTool.setAlign,
    drawing.timeline.frames,
    drawing.timeline.currentFrameIndex,
    drawing.timeline.fps,
    drawing.timeline.isPlaying,
    drawing.timeline.isLooping,
    drawing.timeline.onionSkinEnabled,
    drawing.timeline.selectFrame,
    drawing.timeline.addFrame,
    drawing.timeline.duplicateFrame,
    drawing.timeline.deleteFrame,
    drawing.timeline.nextFrame,
    drawing.timeline.prevFrame,
    drawing.timeline.firstFrame,
    drawing.timeline.lastFrame,
    drawing.timeline.togglePlay,
    drawing.timeline.setIsLooping,
    drawing.timeline.toggleOnionSkin,
    drawing.timeline.setFps,
    drawing.canvasWidth,
    drawing.canvasHeight,
    drawing.layers,
    drawing.activeLayerId,
    drawing.addLayer,
    drawing.deleteLayer,
    drawing.toggleLayerVisibility,
    drawing.toggleLayerLock,
    drawing.toggleLayerClipped,
    drawing.toggleLayerAlphaLock,
    drawing.selectLayer,
    drawing.reorderLayer,
    drawing.setLayerOpacity,
    drawing.setLayerBlendMode,
  ]);

  // ── Desktop menu definitions ──
  const fileMenu: MenuDef = {
    label: "File",
    items: [
      { type: "action", label: "New", onClick: () => setShowNewDialog(true) },
      { type: "action", label: "Open Image", onClick: () => openFileInputRef.current?.click() },
      { type: "action", label: "Open Project (.dwp)", onClick: () => dwpFileInputRef.current?.click() },
      { type: "action", label: "Save", shortcut: "Ctrl+S", onClick: () => setShowSaveDialog(true) },
      { type: "action", label: "Close", onClick: () => activeTabId && onCloseTab(activeTabId) },
    ],
  };

  const editMenu: MenuDef = {
    label: "Edit",
    items: [
      { type: "action", label: "Undo", shortcut: "Ctrl+Z", onClick: () => drawing.undo() },
      { type: "action", label: "Redo", shortcut: "Ctrl+Y", onClick: () => drawing.redo() },
    ],
  };

  const effectsMenu: MenuDef = {
    label: "Effects",
    items: [
      { type: "action", label: "Blur (Soft)", onClick: () => drawing.applyFilterToActiveLayer("blur(4px)") },
      { type: "action", label: "Blur (Strong)", onClick: () => drawing.applyFilterToActiveLayer("blur(12px)") },
      { type: "action", label: "Grayscale", onClick: () => drawing.applyFilterToActiveLayer("grayscale(100%)") },
      { type: "action", label: "Invert", onClick: () => drawing.applyFilterToActiveLayer("invert(100%)") },
      { type: "action", label: "Sepia", onClick: () => drawing.applyFilterToActiveLayer("sepia(100%)") },
      { type: "action", label: "Brighten", onClick: () => drawing.applyFilterToActiveLayer("brightness(150%)") },
      { type: "action", label: "Darken", onClick: () => drawing.applyFilterToActiveLayer("brightness(50%)") },
      { type: "action", label: "High Contrast", onClick: () => drawing.applyFilterToActiveLayer("contrast(200%)") },
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
      {
        type: "checkbox",
        label: "Brush Settings",
        checked: isPanelVisible("brushSettings"),
        onToggle: () => togglePanelVisibility("brushSettings"),
      },
      { type: "checkbox", label: "Color", checked: isPanelVisible("hue"), onToggle: () => togglePanelVisibility("hue") },
      {
        type: "checkbox",
        label: "Layers",
        checked: isPanelVisible("layers"),
        onToggle: () => togglePanelVisibility("layers"),
      },
      {
        type: "checkbox",
        label: "Timeline Animasi",
        checked: isPanelVisible("timeline"),
        onToggle: () => togglePanelVisibility("timeline"),
      },
      {
        type: "checkbox",
        label: "Jendela Referensi",
        checked: showReferenceWindow,
        onToggle: () => setShowReferenceWindow((p) => !p),
      },
    ],
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // ── Shift+Drag to Resize Brush ─────────────────────────
  const resizeDragStart = useRef<{ clientX: number; startSize: number } | null>(null);

  const handlePointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    // Hanya aktif jika menekan Shift dan bukan klik kanan
    if (e.shiftKey && e.button !== 2) {
      e.preventDefault();
      e.stopPropagation();
      resizeDragStart.current = { clientX: e.clientX, startSize: brushSize };
      try {
        (e.target as Element).setPointerCapture(e.pointerId);
      } catch (err) {
        // Abaikan jika tidak didukung
      }
    }
  };

  const handlePointerMoveCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (resizeDragStart.current) {
      e.preventDefault();
      e.stopPropagation();
      const dx = e.clientX - resizeDragStart.current.clientX;
      // 1px geser mouse = 0.5px ubah brush size
      const newSize = Math.max(1, Math.min(500, Math.round(resizeDragStart.current.startSize + dx * 0.5)));
      if (newSize !== brushSize) {
        setBrushSize(newSize);
      }
    }
  };

  const handlePointerUpCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (resizeDragStart.current) {
      e.preventDefault();
      e.stopPropagation();
      resizeDragStart.current = null;
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch (err) {
        // Abaikan
      }
    }
  };

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
          onRedo={drawing.redo}
          canUndo={drawing.canUndo}
          canRedo={drawing.canRedo}
          onSave={() => setShowSaveDialog(true)}
          onNewFile={() => setShowNewDialog(true)}
          onOpenFile={onOpenTabFile}
          onCloseTab={() => activeTabId && onCloseTab(activeTabId)}
          onOpenAI={() => setIsAIAssistantOpen((p) => !p)}
          isAIOpen={isAIAssistantOpen}
          color={color}
          tabTitle={activeTab?.title ?? ""}
        />


        {/* Fullscreen canvas in the middle */}
        <div 
          className="flex-1 min-h-0 relative"
          onPointerDownCapture={handlePointerDownCapture}
          onPointerMoveCapture={handlePointerMoveCapture}
          onPointerUpCapture={handlePointerUpCapture}
        >
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
            activeTool={activeTool}
            brushSize={brushSize}
            textToolState={drawing.textTool.textState}
            textFontSize={drawing.textTool.fontSize}
            textFontFamily={drawing.textTool.fontFamily}
            textIsBold={drawing.textTool.isBold}
            textIsItalic={drawing.textTool.isItalic}
            textAlign={drawing.textTool.align}
            textColor={color}
            onTextChange={drawing.textTool.updateText}
            onTextCommit={(t) =>
              drawing.textTool.commitText(
                t,
                drawing.textTool.textState.docX,
                drawing.textTool.textState.docY,
              )
            }
            onTextCancel={drawing.textTool.cancelText}
            onTextFontSizeChange={drawing.textTool.setFontSize}
            onTextFontFamilyChange={drawing.textTool.setFontFamily}
            onTextToggleBold={() => drawing.textTool.setIsBold((b) => !b)}
            onTextToggleItalic={() => drawing.textTool.setIsItalic((i) => !i)}
            onTextAlignChange={drawing.textTool.setAlign}
            selectionState={drawing.selectionTool.selState}
            selectionDashOffset={drawing.selectionTool.dashOffset}
            onSelectionCut={() => drawing.selectionTool.copySelection(true)}
            onSelectionCopy={() => drawing.selectionTool.copySelection(false)}
            onSelectionFill={drawing.selectionTool.fillSelection}
            onSelectionClear={drawing.selectionTool.clearSelection}
            onSelectionMove={drawing.selectionTool.startMoveSelection}
            onSelectionCommitMove={drawing.selectionTool.commitMove}
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

            {/* Mobile Brush Opacity Slider */}
            <div className="mb-3 pb-3 border-b border-neutral-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-neutral-400 font-medium">Opacity Brush</span>
                <span className="text-xs font-mono text-white bg-neutral-800 px-2 py-0.5 rounded">
                  {brushOpacity}%
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={brushOpacity}
                onChange={(e) => setBrushOpacity(Number(e.target.value))}
                className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Mobile Stabilizer Slider */}
            <div className="mb-3.5 pb-3 border-b border-neutral-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-neutral-400 font-medium">Stabilizer (Penghalus)</span>
                <span className="text-xs font-mono text-white bg-neutral-800 px-2 py-0.5 rounded">
                  {stabilizerStrength === 0 ? "Off" : stabilizerStrength}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                value={stabilizerStrength}
                onChange={(e) => setStabilizerStrength(Number(e.target.value))}
                className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
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
              onToggleClipped={drawing.toggleLayerClipped}
              onToggleAlphaLock={drawing.toggleLayerAlphaLock}
              onSelect={drawing.selectLayer}
              onReorder={drawing.reorderLayer}
              onOpacityChange={drawing.setLayerOpacity}
              onBlendModeChange={drawing.setLayerBlendMode}
            />
          </div>
        </BottomSheet>

        <AIAssistantPanel
          key={activeTabId ?? "default"}
          isOpen={isAIAssistantOpen}
          onClose={() => setIsAIAssistantOpen(false)}
          activeTabId={activeTabId}
          canvasRef={drawing.canvasRef}
          setters={toolSetters}
        />

        {showNewDialog && (
          <NewImageDialog
            onCreate={(size) => {
              setShowNewDialog(false);
              onNewTab(size);
            }}
            onCancel={() => setShowNewDialog(false)}
          />
        )}

        <SaveDialog
          isOpen={showSaveDialog}
          onClose={() => setShowSaveDialog(false)}
          onSavePng={() => drawing.exportImage()}
          onSaveProject={() => drawing.saveProject()}
          projectTitle={activeTab?.title ?? "project"}
        />

        <ReferenceWindow 
          isOpen={showReferenceWindow}
          onClose={() => setShowReferenceWindow(false)}
        />
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
        <div className="flex items-center gap-3">
          <MenuBar menus={[fileMenu, editMenu, effectsMenu, workspaceMenu]} />
          <div className="flex items-center gap-0.5 bg-neutral-800/80 rounded-lg p-0.5 border border-neutral-700/60">
            <button
              onClick={() => drawing.undo()}
              disabled={!drawing.canUndo}
              className="p-1.5 rounded text-neutral-300 hover:text-white hover:bg-neutral-700/70 active:scale-95 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:active:scale-100 cursor-pointer disabled:cursor-not-allowed"
              title="Urungkan (Undo) — Ctrl+Z"
            >
              <Undo2 size={15} />
            </button>
            <button
              onClick={() => drawing.redo()}
              disabled={!drawing.canRedo}
              className="p-1.5 rounded text-neutral-300 hover:text-white hover:bg-neutral-700/70 active:scale-95 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:active:scale-100 cursor-pointer disabled:cursor-not-allowed"
              title="Ulangi (Redo) — Ctrl+Y / Ctrl+Shift+Z"
            >
              <Redo2 size={15} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">

          <BrushOpacityControl
            opacity={brushOpacity}
            onChange={setBrushOpacity}
            color={color}
            isEraser={activeTool === "eraser"}
          />
          <div className="w-px h-5 bg-neutral-700 shrink-0" />
          <BrushSizeControl
            size={brushSize}
            onChange={setBrushSize}
            color={color}
            isEraser={activeTool === "eraser"}
            compact={false}
          />
          <div className="w-px h-5 bg-neutral-700 shrink-0" />
          <button
            onClick={() => setIsAIAssistantOpen((p) => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all active:scale-95 ${
              isAIAssistantOpen
                ? "bg-indigo-600 text-white border-indigo-500 shadow-md"
                : "bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border-neutral-700"
            }`}
            title="Buka AI Drawing Assistant"
          >
            <Sparkles size={14} className={isAIAssistantOpen ? "text-yellow-300 animate-pulse" : "text-indigo-400"} />
            <span>AI Assistant</span>
          </button>
        </div>
      </div>

      <input
        ref={openFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleOpenFileChange}
      />
      <input
        ref={dwpFileInputRef}
        type="file"
        accept=".dwp"
        className="hidden"
        onChange={async (e: ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (file && file.name.endsWith(".dwp")) {
            try {
              await drawing.loadProjectFromFile(file);
            } catch (err) {
              console.error("Gagal membuka proyek:", err);
              alert("Gagal membuka file proyek. Pastikan file .dwp valid.");
            }
          }
          e.target.value = "";
        }}
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
          <div 
            className="flex-1 min-h-0"
            onPointerDownCapture={handlePointerDownCapture}
            onPointerMoveCapture={handlePointerMoveCapture}
            onPointerUpCapture={handlePointerUpCapture}
          >
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
              activeTool={activeTool}
              brushSize={brushSize}
              textToolState={drawing.textTool.textState}
              textFontSize={drawing.textTool.fontSize}
              textFontFamily={drawing.textTool.fontFamily}
              textIsBold={drawing.textTool.isBold}
              textIsItalic={drawing.textTool.isItalic}
              textAlign={drawing.textTool.align}
              textColor={color}
              onTextChange={drawing.textTool.updateText}
              onTextCommit={(t) =>
                drawing.textTool.commitText(
                  t,
                  drawing.textTool.textState.docX,
                  drawing.textTool.textState.docY,
                )
              }
              onTextCancel={drawing.textTool.cancelText}
              onTextFontSizeChange={drawing.textTool.setFontSize}
              onTextFontFamilyChange={drawing.textTool.setFontFamily}
              onTextToggleBold={() => drawing.textTool.setIsBold((b) => !b)}
              onTextToggleItalic={() => drawing.textTool.setIsItalic((i) => !i)}
              onTextAlignChange={drawing.textTool.setAlign}
              selectionState={drawing.selectionTool.selState}
              selectionDashOffset={drawing.selectionTool.dashOffset}
              onSelectionCut={() => drawing.selectionTool.copySelection(true)}
              onSelectionCopy={() => drawing.selectionTool.copySelection(false)}
              onSelectionFill={drawing.selectionTool.fillSelection}
              onSelectionClear={drawing.selectionTool.clearSelection}
              onSelectionMove={drawing.selectionTool.startMoveSelection}
              onSelectionCommitMove={drawing.selectionTool.commitMove}
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

      <AIAssistantPanel
        key={activeTabId ?? "default"}
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        activeTabId={activeTabId}
        canvasRef={drawing.canvasRef}
        setters={toolSetters}
      />

      <SaveDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSavePng={() => drawing.exportImage()}
        onSaveProject={() => drawing.saveProject()}
        projectTitle={activeTab?.title ?? "project"}
      />

      <ReferenceWindow 
        isOpen={showReferenceWindow}
        onClose={() => setShowReferenceWindow(false)}
      />
    </div>
  );
}