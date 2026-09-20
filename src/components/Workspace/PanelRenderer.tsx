import type { DragEvent, ReactNode } from "react";
import { PanelShell } from "./PanelShell";
import { IconGridPanel } from "./IconGridPanel";
import { HuePanel } from "./HuePanel";
import { LayersPanel } from "./LayersPanel";
import { BrushSettingsPanel } from "./BrushSettingsPanel";
import { TOOLS, BRUSHES } from "./toolsData";
import { BRUSH_ITEM_SIZE, BRUSH_GRID_GAP } from "./layoutConstants";
import type { PanelId } from "./types";
import type { LayerMeta } from "../../types/drawing";

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
        <PanelShell title="Brush Settings" {...common}>
          <BrushSettingsPanel
            brushOpacity={brushOpacity}
            onBrushOpacityChange={onBrushOpacityChange}
            stabilizerStrength={stabilizerStrength}
            onStabilizerStrengthChange={onStabilizerStrengthChange}
            shapeFilled={shapeFilled}
            onShapeFilledChange={onShapeFilledChange}
            activeTool={activeTool}
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
            onSelect={onSelectLayer}
            onReorder={onReorderLayer}
            onOpacityChange={onLayerOpacityChange}
            onBlendModeChange={onLayerBlendModeChange}
          />
        </PanelShell>
      );

    default:
      return null;
  }
}
