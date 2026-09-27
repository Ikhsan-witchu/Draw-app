import type { DragEvent, ReactNode } from "react";
import { PanelShell } from "./PanelShell";
import { IconGridPanel } from "./IconGridPanel";
import { HuePanel } from "./HuePanel";
import { LayersPanel } from "./LayersPanel";
import { BrushSettingsPanel } from "./BrushSettingsPanel";
import { TimelinePanel } from "./TimelinePanel";
import { TOOLS, BRUSHES } from "./toolsData";
import { BRUSH_ITEM_SIZE, BRUSH_GRID_GAP } from "./layoutConstants";
import type { PanelId } from "./types";
import type { AnimationFrame, LayerMeta } from "../../types/drawing";
import type { TextAlign } from "../../hooks/useTextTool";

interface PanelRendererProps {
  id: PanelId;
  dragPanel: PanelId | null;
  onDragStart: (e: DragEvent<HTMLDivElement>, id: PanelId) => void;
  onDragEnd: () => void;
  // Tools
  activeTool: string;
  onSelectTool: (toolId: string) => void;
  // Brushes
  activeBrush: string;
  onSelectBrush: (brushId: string) => void;
  // Brush & Drawing Settings
  brushOpacity: number;
  onBrushOpacityChange: (val: number) => void;
  stabilizerStrength: number;
  onStabilizerStrengthChange: (val: number) => void;
  shapeFilled: boolean;
  onShapeFilledChange: (val: boolean) => void;
  // Text Tool
  textFontSize?: number;
  onTextFontSizeChange?: (size: number) => void;
  textFontFamily?: string;
  onTextFontFamilyChange?: (family: string) => void;
  textIsBold?: boolean;
  onTextToggleBold?: () => void;
  textIsItalic?: boolean;
  onTextToggleItalic?: () => void;
  textAlign?: TextAlign;
  onTextAlignChange?: (align: TextAlign) => void;
  // Timeline Animation
  frames?: AnimationFrame[];
  currentFrameIndex?: number;
  fps?: number;
  isPlaying?: boolean;
  isLooping?: boolean;
  onionSkinEnabled?: boolean;
  canvasWidth?: number;
  canvasHeight?: number;
  onSelectFrame?: (index: number) => void;
  onAddFrame?: () => void;
  onDuplicateFrame?: () => void;
  onDeleteFrame?: (index?: number) => void;
  onNextFrame?: () => void;
  onPrevFrame?: () => void;
  onFirstFrame?: () => void;
  onLastFrame?: () => void;
  onTogglePlay?: () => void;
  onToggleLoop?: () => void;
  onToggleOnionSkin?: () => void;
  onFpsChange?: (fps: number) => void;
  // Color
  hue: number;
  sat: number;
  val: number;
  onColorChange: (color: { hue: number; sat: number; val: number }) => void;
  // Layers
  layers: LayerMeta[];
  activeLayerId: string | null;
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onToggleLayerVisible: (id: string) => void;
  onToggleLayerLock: (id: string) => void;
  onToggleLayerClipped?: (id: string) => void;
  onToggleLayerAlphaLock?: (id: string) => void;
  onSelectLayer: (id: string) => void;
  onReorderLayer: (draggedId: string, targetId: string, position: "before" | "after") => void;
  onLayerOpacityChange?: (id: string, opacity: number) => void;
  onLayerBlendModeChange?: (id: string, blendMode: GlobalCompositeOperation) => void;
}

export function PanelRenderer({
  id,
  dragPanel,
  onDragStart,
  onDragEnd,
  activeTool,
  onSelectTool,
  activeBrush,
  onSelectBrush,
  brushOpacity,
  onBrushOpacityChange,
  stabilizerStrength,
  onStabilizerStrengthChange,
  shapeFilled,
  onShapeFilledChange,
  textFontSize,
  onTextFontSizeChange,
  textFontFamily,
  onTextFontFamilyChange,
  textIsBold,
  onTextToggleBold,
  textIsItalic,
  onTextToggleItalic,
  textAlign,
  onTextAlignChange,
  frames,
  currentFrameIndex,
  fps,
  isPlaying,
  isLooping,
  onionSkinEnabled,
  canvasWidth,
  canvasHeight,
  onSelectFrame,
  onAddFrame,
  onDuplicateFrame,
  onDeleteFrame,
  onNextFrame,
  onPrevFrame,
  onFirstFrame,
  onLastFrame,
  onTogglePlay,
  onToggleLoop,
  onToggleOnionSkin,
  onFpsChange,
  hue,
  sat,
  val,
  onColorChange,
  layers,
  activeLayerId,
  onAddLayer,
  onDeleteLayer,
  onToggleLayerVisible,
  onToggleLayerLock,
  onToggleLayerClipped,
  onToggleLayerAlphaLock,
  onSelectLayer,
  onReorderLayer,
  onLayerOpacityChange,
  onLayerBlendModeChange,
}: PanelRendererProps): ReactNode {
  const common = {
    dimmed: dragPanel === id,
    onDragStart: (e: DragEvent<HTMLDivElement>) => onDragStart(e, id),
    onDragEnd,
  };

  switch (id) {
    case "tools":
      return (
        <PanelShell title="Tools" {...common}>
          <IconGridPanel items={TOOLS} activeId={activeTool} onSelect={onSelectTool} />
        </PanelShell>
      );

    case "brushes":
      return (
        <PanelShell title="Brush Palette" {...common}>
          <IconGridPanel
            items={BRUSHES}
            activeId={activeBrush}
            onSelect={onSelectBrush}
            itemSize={BRUSH_ITEM_SIZE}
            iconSize={18}
            gap={BRUSH_GRID_GAP}
          />
        </PanelShell>
      );

    case "brushSettings":
      return (
        <PanelShell title={activeTool === "text" ? "Text Settings" : "Brush Settings"} {...common}>
          <BrushSettingsPanel
            brushOpacity={brushOpacity}
            onBrushOpacityChange={onBrushOpacityChange}
            stabilizerStrength={stabilizerStrength}
            onStabilizerStrengthChange={onStabilizerStrengthChange}
            shapeFilled={shapeFilled}
            onShapeFilledChange={onShapeFilledChange}
            activeTool={activeTool}
            textFontSize={textFontSize}
            onTextFontSizeChange={onTextFontSizeChange}
            textFontFamily={textFontFamily}
            onTextFontFamilyChange={onTextFontFamilyChange}
            textIsBold={textIsBold}
            onTextToggleBold={onTextToggleBold}
            textIsItalic={textIsItalic}
            onTextToggleItalic={onTextToggleItalic}
            textAlign={textAlign}
            onTextAlignChange={onTextAlignChange}
          />
        </PanelShell>
      );

    case "hue":
      return (
        <PanelShell title="Color" {...common}>
          <HuePanel hue={hue} sat={sat} val={val} onChange={onColorChange} />
        </PanelShell>
      );

    case "layers":
      return (
        <PanelShell title="Layers" {...common}>
          <LayersPanel
            layers={layers}
            activeLayerId={activeLayerId}
            onAdd={onAddLayer}
            onDelete={onDeleteLayer}
            onToggleVisible={onToggleLayerVisible}
            onToggleLock={onToggleLayerLock}
            onToggleClipped={onToggleLayerClipped}
            onToggleAlphaLock={onToggleLayerAlphaLock}
            onSelect={onSelectLayer}
            onReorder={onReorderLayer}
            onOpacityChange={onLayerOpacityChange}
            onBlendModeChange={onLayerBlendModeChange}
          />
        </PanelShell>
      );

    case "timeline":
      return (
        <PanelShell title="Timeline Animasi" {...common}>
          <TimelinePanel
            frames={frames ?? []}
            currentFrameIndex={currentFrameIndex ?? 0}
            fps={fps ?? 6.0}
            isPlaying={isPlaying ?? false}
            isLooping={isLooping ?? true}
            onionSkinEnabled={onionSkinEnabled ?? false}
            layers={layers}
            canvasWidth={canvasWidth ?? 1080}
            canvasHeight={canvasHeight ?? 1080}
            onSelectFrame={onSelectFrame ?? (() => {})}
            onAddFrame={onAddFrame ?? (() => {})}
            onDuplicateFrame={onDuplicateFrame ?? (() => {})}
            onDeleteFrame={onDeleteFrame ?? (() => {})}
            onNextFrame={onNextFrame ?? (() => {})}
            onPrevFrame={onPrevFrame ?? (() => {})}
            onFirstFrame={onFirstFrame ?? (() => {})}
            onLastFrame={onLastFrame ?? (() => {})}
            onTogglePlay={onTogglePlay ?? (() => {})}
            onToggleLoop={onToggleLoop ?? (() => {})}
            onToggleOnionSkin={onToggleOnionSkin ?? (() => {})}
            onFpsChange={onFpsChange ?? (() => {})}
          />
        </PanelShell>
      );

    default:
      return null;
  }
}
