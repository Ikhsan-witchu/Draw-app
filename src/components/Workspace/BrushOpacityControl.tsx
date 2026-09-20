import { useState, useRef, useEffect } from "react";

interface BrushOpacityControlProps {
  opacity: number; // 1–100
  onChange: (opacity: number) => void;
  color: string;
  isEraser?: boolean;
}

const PRESET_OPACITIES = [10, 25, 50, 75, 90, 100];

/** Inline control shown in the desktop top bar. */
export function BrushOpacityControl({
  opacity,
  onChange,
  color,
  isEraser = false,
}: BrushOpacityControlProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      window.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("touchstart", handleClickOutside, { passive: true });
      return () => {
        window.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("touchstart", handleClickOutside);
      };
    }
  }, [open]);

  /** Alpha value for CSS (0.0–1.0) */
  const cssAlpha = opacity / 100;

  return (
    <div className="flex items-center gap-2 text-neutral-300">
      <span className="text-xs text-neutral-400 font-medium">Opacity:</span>

      {/* Slider */}
      <input
        type="range"
        min={1}
        max={100}
        value={opacity}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 sm:w-28 h-1.5 rounded-lg appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${isEraser ? "#e5e5e5" : color} ${opacity}%, #404040 ${opacity}%)`,
          accentColor: isEraser ? "#e5e5e5" : color,
        }}
        title={`Opacity: ${opacity}%`}
      />

      {/* Number input / Badge */}
      <div
        ref={popoverRef}
        className="relative flex items-center gap-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-0.5 min-w-[52px] justify-center cursor-pointer hover:border-neutral-500 transition-colors"
        onClick={() => setOpen((p) => !p)}
        title="Klik untuk memilih preset opacity"
      >
        <span className="w-7 text-xs text-center text-white select-none">{opacity}</span>
        <span className="text-[10px] text-neutral-400">%</span>

        {/* Preset popover */}
        {open && (
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-full right-0 mt-2 p-3 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-50 min-w-[180px] animate-slide-up pointer-events-auto"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400 font-medium">Opacity</span>
              <span className="text-xs font-mono text-white bg-neutral-800 px-2 py-0.5 rounded">
                {opacity}%
              </span>
            </div>

            {/* Slider inside popover */}
            <input
              type="range"
              min={1}
              max={100}
              value={opacity}
              onChange={(e) => onChange(Number(e.target.value))}
              className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer mb-3"
              style={{ accentColor: isEraser ? "#e5e5e5" : color }}
            />

            {/* Preset buttons */}
            <div className="grid grid-cols-6 gap-1 mb-3">
              {PRESET_OPACITIES.map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    onChange(preset);
                    setOpen(false);
                  }}
                  className={`py-1 text-[10px] rounded transition-colors ${
                    opacity === preset
                      ? "bg-white text-neutral-950 font-bold"
                      : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Live preview */}
            <div className="h-10 bg-neutral-950 rounded-lg border border-neutral-800 flex items-center justify-center overflow-hidden"
                 style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='4' height='4' fill='%23555'/%3E%3Crect x='4' y='4' width='4' height='4' fill='%23555'/%3E%3Crect x='4' y='0' width='4' height='4' fill='%23333'/%3E%3Crect x='0' y='4' width='4' height='4' fill='%23333'/%3E%3C/svg%3E\")" }}>
              <div
                className="w-6 h-6 rounded-full"
                style={{
                  backgroundColor: isEraser ? `rgba(229,229,229,${cssAlpha})` : color.replace(")", `, ${cssAlpha})`).replace("hsl", "hsla"),
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Live preview dot in top bar */}
      <div className="w-8 h-8 flex items-center justify-center bg-neutral-800/80 rounded border border-neutral-700/80 shrink-0"
           style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='4' height='4' fill='%23555'/%3E%3Crect x='4' y='4' width='4' height='4' fill='%23555'/%3E%3Crect x='4' y='0' width='4' height='4' fill='%23333'/%3E%3Crect x='0' y='4' width='4' height='4' fill='%23333'/%3E%3C/svg%3E\")"}}>
        <div
          className="w-5 h-5 rounded-full shrink-0"
          style={{
            backgroundColor: isEraser
              ? `rgba(229,229,229,${cssAlpha})`
              : color.replace(")", `, ${cssAlpha})`).replace("hsl", "hsla"),
            boxShadow: isEraser ? "0 0 0 1px #737373" : "none",
          }}
        />
      </div>
    </div>
  );
}
