import { useRef, type PointerEvent as ReactPointerEvent } from "react";

interface HueValue {
  hue: number;
  sat: number;
  val: number;
}

interface HuePanelProps extends HueValue {
  onChange: (next: HueValue) => void;
}

export function HuePanel({ hue, sat, val, onChange }: HuePanelProps) {
  const svRef = useRef<HTMLDivElement | null>(null);
  const draggingSv = useRef(false);

  function updateSv(clientX: number, clientY: number) {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, clientX - rect.left));
    const y = Math.min(rect.height, Math.max(0, clientY - rect.top));
    onChange({
      hue,
      sat: Math.round((x / rect.width) * 100),
      val: Math.round(100 - (y / rect.height) * 100),
    });
  }

  function handleSvDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingSv.current = true;
    updateSv(e.clientX, e.clientY);
  }

  function handleSvMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingSv.current) return;
    updateSv(e.clientX, e.clientY);
  }

  const currentColor = `hsl(${hue}, ${sat}%, ${val}%)`;

  return (
    <div className="p-3 flex flex-col gap-3 h-full">
      <div
        ref={svRef}
        onPointerDown={handleSvDown}
        onPointerMove={handleSvMove}
        onPointerUp={() => (draggingSv.current = false)}
        className="w-full aspect-square rounded-md relative cursor-crosshair shrink-0"
        style={{
          backgroundColor: `hsl(${hue}, 100%, 50%)`,
          backgroundImage:
            "linear-gradient(to top, #000000, rgba(0,0,0,0)), linear-gradient(to right, #ffffff, rgba(255,255,255,0))",
        }}
      >
        <div
          className="absolute w-3 h-3 rounded-full border-2 border-white shadow pointer-events-none"
          style={{ left: `${sat}%`, top: `${100 - val}%`, transform: "translate(-50%, -50%)" }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={360}
        value={hue}
        onChange={(e) => onChange({ hue: Number(e.target.value), sat, val })}
        className="w-full accent-white shrink-0"
      />

      <div className="flex items-center gap-2 shrink-0">
        <div
          className="w-8 h-8 rounded-md border border-neutral-700 shrink-0"
          style={{ backgroundColor: currentColor }}
        />
        <span className="text-xs text-neutral-500 truncate">{currentColor}</span>
      </div>
    </div>
  );
}
