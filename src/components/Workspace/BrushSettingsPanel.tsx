import {
  Sliders,
  Sparkles,
  Square,
  CheckSquare,
  Type,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import type { TextAlign } from "../../hooks/useTextTool";
import { FONT_FAMILIES } from "../Canvas/TextOverlay";

interface BrushSettingsPanelProps {
  brushOpacity: number; // 1 - 100
  onBrushOpacityChange: (val: number) => void;
  stabilizerStrength: number; // 0 - 10
  onStabilizerStrengthChange: (val: number) => void;
  shapeFilled: boolean;
  onShapeFilledChange: (val: boolean) => void;
  activeTool: string;
  // Text Tool Settings
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
}

export function BrushSettingsPanel({
  brushOpacity,
  onBrushOpacityChange,
  stabilizerStrength,
  onStabilizerStrengthChange,
  shapeFilled,
  onShapeFilledChange,
  activeTool,
  textFontSize = 24,
  onTextFontSizeChange,
  textFontFamily = "sans-serif",
  onTextFontFamilyChange,
  textIsBold = false,
  onTextToggleBold,
  textIsItalic = false,
  onTextToggleItalic,
  textAlign = "left",
  onTextAlignChange,
}: BrushSettingsPanelProps) {
  const isShapeTool = ["line", "rectShape", "ellipseShape", "gradient"].includes(activeTool);
  const isTextTool = activeTool === "text";

  if (isTextTool) {
    return (
      <div className="p-3 flex flex-col gap-4 text-neutral-200 text-xs select-none">
        <div className="flex items-center gap-1.5 text-neutral-400 font-medium pb-2 border-b border-neutral-800">
          <Type size={14} className="text-indigo-400" />
          <span className="text-white font-semibold">Format Teks</span>
        </div>

        {/* Font Family */}
        {onTextFontFamilyChange && (
          <div className="flex flex-col gap-1.5">
            <span className="text-neutral-400 font-medium">Jenis Huruf (Font)</span>
            <select
              value={textFontFamily}
              onChange={(e) => onTextFontFamilyChange(e.target.value)}
              className="w-full bg-neutral-800 text-xs text-neutral-200 rounded-lg p-2 border border-neutral-700 outline-none cursor-pointer hover:bg-neutral-750 transition-colors"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Font Size Slider & Number */}
        {onTextFontSizeChange && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-neutral-400 font-medium">
              <span>Ukuran Huruf</span>
              <span className="text-white font-mono text-[11px] bg-neutral-800 px-2 py-0.5 rounded">
                {textFontSize} px
              </span>
            </div>
            <input
              type="range"
              min={8}
              max={300}
              value={textFontSize}
              onChange={(e) => onTextFontSizeChange(Number(e.target.value))}
              className="w-full accent-indigo-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500">
              <span>8 px</span>
              <span>300 px</span>
            </div>
          </div>
        )}

        {/* Style & Alignment */}
        <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800">
          <span className="text-neutral-400 font-medium">Gaya & Perataan</span>
          <div className="flex items-center gap-1.5">
            {/* Bold */}
            {onTextToggleBold && (
              <button
                onClick={onTextToggleBold}
                title="Tebal (Bold)"
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  textIsBold
                    ? "bg-indigo-600 text-white border-indigo-500 shadow"
                    : "bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 border-neutral-700"
                }`}
              >
                <Bold size={13} />
                <span>B</span>
              </button>
            )}

            {/* Italic */}
            {onTextToggleItalic && (
              <button
                onClick={onTextToggleItalic}
                title="Miring (Italic)"
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs italic transition-all ${
                  textIsItalic
                    ? "bg-indigo-600 text-white border-indigo-500 shadow"
                    : "bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 border-neutral-700"
                }`}
              >
                <Italic size={13} />
                <span>I</span>
              </button>
            )}
          </div>

          {/* Alignment */}
          {onTextAlignChange && (
            <div className="grid grid-cols-3 gap-1 bg-neutral-900/60 p-1 rounded-lg border border-neutral-800">
              <button
                onClick={() => onTextAlignChange("left")}
                title="Rata Kiri"
                className={`flex items-center justify-center py-1 rounded transition-colors ${
                  textAlign === "left"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                }`}
              >
                <AlignLeft size={13} />
              </button>
              <button
                onClick={() => onTextAlignChange("center")}
                title="Rata Tengah"
                className={`flex items-center justify-center py-1 rounded transition-colors ${
                  textAlign === "center"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                }`}
              >
                <AlignCenter size={13} />
              </button>
              <button
                onClick={() => onTextAlignChange("right")}
                title="Rata Kanan"
                className={`flex items-center justify-center py-1 rounded transition-colors ${
                  textAlign === "right"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                }`}
              >
                <AlignRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 flex flex-col gap-4 text-neutral-200 text-xs select-none">
      {/* Opacity Setting */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-neutral-400 font-medium">
          <span className="flex items-center gap-1.5">
            <Sliders size={13} />
            Opacity Brush
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
