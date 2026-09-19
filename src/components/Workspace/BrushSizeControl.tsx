import { useState, useRef, useEffect } from "react";

interface BrushSizeControlProps {
  size: number;
  onChange: (size: number) => void;
  color: string;
  isEraser?: boolean;
  compact?: boolean;
}

const PRESET_SIZES = [2, 5, 10, 20, 40, 80];

export function BrushSizeControl({
  size,
  onChange,
  color,
  isEraser = false,
  compact = false,
}: BrushSizeControlProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      window.addEventListener("mousedown", handleClickOutside);
      return () => window.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Preview circle size (clamped for UI display)
  const previewDiameter = Math.min(Math.max(size, 4), 32);

  // Desktop inline/expanded view
  if (!compact) {
    return (
      <div className="flex items-center gap-2 text-neutral-300">
        <span className="text-xs text-neutral-400 font-medium">Size:</span>

        {/* Slider */}
        <input
          type="range"
          min={1}
          max={100}
          value={size}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 sm:w-32 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-white"
          title={`Brush Size: ${size}px`}
        />

        {/* Number input / Badge */}
        <div className="flex items-center gap-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-0.5 min-w-[52px] justify-center">
          <input
            type="number"
            min={1}
            max={250}
            value={size}
            onChange={(e) => onChange(Math.max(1, Math.min(250, Number(e.target.value))))}
            className="w-7 bg-transparent text-xs text-center text-white focus:outline-none"
          />
          <span className="text-[10px] text-neutral-400">px</span>
        </div>

        {/* Live Preview Dot */}
        <div className="w-8 h-8 flex items-center justify-center bg-neutral-800/80 rounded border border-neutral-700/80 shrink-0">
          <div
            className="rounded-full shrink-0"
            style={{
              width: `${previewDiameter}px`,
              height: `${previewDiameter}px`,
              backgroundColor: isEraser ? "#e5e5e5" : color,
              boxShadow: isEraser ? "0 0 0 1px #737373" : "none",
            }}
          />
        </div>
      </div>
    );
  }

  // Mobile / Compact Popover view
  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
          open
            ? "bg-neutral-800 text-white border border-neutral-700"
            : "text-neutral-300 hover:bg-neutral-800 border border-neutral-800"
        }`}
        title="Ubah Ukuran Pen/Brush"
      >
        <div
          className="rounded-full shrink-0"
          style={{
            width: `${Math.min(Math.max(size, 4), 14)}px`,
            height: `${Math.min(Math.max(size, 4), 14)}px`,
            backgroundColor: isEraser ? "#e5e5e5" : color,
          }}
        />
        <span className="font-mono text-[11px] font-medium">{size}px</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 p-3 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-50 min-w-[220px] animate-slide-up">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-400 font-medium">Ukuran Pen/Brush</span>
            <span className="text-xs font-mono text-white bg-neutral-800 px-2 py-0.5 rounded">
              {size} px
            </span>
          </div>

          {/* Slider */}
          <input
            type="range"
            min={1}
            max={100}
            value={size}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-white mb-3"
          />

          {/* Preset Buttons */}
          <div className="grid grid-cols-6 gap-1 mb-3">
            {PRESET_SIZES.map((preset) => (
              <button
                key={preset}
                onClick={() => onChange(preset)}
                className={`py-1 text-[10px] rounded transition-colors ${
                  size === preset
                    ? "bg-white text-neutral-950 font-bold"
                    : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Live Circle Preview */}
          <div className="h-16 bg-neutral-950 rounded-lg border border-neutral-800 flex items-center justify-center overflow-hidden">
            <div
              className="rounded-full transition-all"
              style={{
                width: `${Math.min(size, 56)}px`,
                height: `${Math.min(size, 56)}px`,
                backgroundColor: isEraser ? "#e5e5e5" : color,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
