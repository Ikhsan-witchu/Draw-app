import { Sliders, Sparkles, Square, CheckSquare } from "lucide-react";

interface BrushSettingsPanelProps {
  brushOpacity: number; // 1 - 100
  onBrushOpacityChange: (val: number) => void;
  stabilizerStrength: number; // 0 - 10
  onStabilizerStrengthChange: (val: number) => void;
  shapeFilled: boolean;
  onShapeFilledChange: (val: boolean) => void;
  activeTool: string;
}

export function BrushSettingsPanel({
  brushOpacity,
  onBrushOpacityChange,
  stabilizerStrength,
  onStabilizerStrengthChange,
  shapeFilled,
  onShapeFilledChange,
  activeTool,
}: BrushSettingsPanelProps) {
  const isShapeTool = ["line", "rectShape", "ellipseShape", "gradient"].includes(activeTool);

  return (
    <div className="p-3 flex flex-col gap-4 text-neutral-200 text-xs select-none">
      {/* Opacity Setting */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-neutral-400 font-medium">
          <span className="flex items-center gap-1.5">
            <Sliders size={13} />
            Kerapatan / Opacity
          </span>
          <span className="text-white font-mono text-[11px]">{brushOpacity}%</span>
        </div>
        <input
          type="range"
          min={1}
          max={100}
          value={brushOpacity}
          onChange={(e) => onBrushOpacityChange(Number(e.target.value))}
          className="w-full accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
        />
      </div>

      {/* Stabilizer Setting */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-neutral-400 font-medium">
          <span className="flex items-center gap-1.5">
            <Sparkles size={13} />
            Stabilizer (Penghalus)
          </span>
          <span className="text-white font-mono text-[11px]">
            {stabilizerStrength === 0 ? "Off" : stabilizerStrength}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          value={stabilizerStrength}
          onChange={(e) => onStabilizerStrengthChange(Number(e.target.value))}
          className="w-full accent-white h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-neutral-500">
          <span>Cepat (0)</span>
          <span>Stabil (10)</span>
        </div>
      </div>

      {/* Shape Settings */}
      {isShapeTool && (
        <div className="pt-2 border-t border-neutral-800 flex flex-col gap-2">
          <span className="text-neutral-400 font-medium">Pengaturan Bentuk (Shape)</span>
          {activeTool !== "line" && activeTool !== "gradient" && (
            <button
              onClick={() => onShapeFilledChange(!shapeFilled)}
              className="flex items-center gap-2 px-2 py-1.5 bg-neutral-800/80 hover:bg-neutral-800 rounded text-neutral-200 transition-colors"
            >
              {shapeFilled ? (
                <CheckSquare size={14} className="text-white" />
              ) : (
                <Square size={14} className="text-neutral-400" />
              )}
              <span>Bentuk Berisi (Filled Shape)</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
