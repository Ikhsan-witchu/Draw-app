import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

interface HueValue {
  hue: number;
  sat: number;
  val: number;
}

interface HuePanelProps extends HueValue {
  onChange: (next: HueValue) => void;
}

const HUE_STRIP_WIDTH = 16;
const GAP = 8;

export function HuePanel({ hue, sat, val, onChange }: HuePanelProps) {
  const fitRef = useRef<HTMLDivElement | null>(null);
  const svRef = useRef<HTMLDivElement | null>(null);
  const hueStripRef = useRef<HTMLDivElement | null>(null);
  const draggingSv = useRef(false);
  const draggingHue = useRef(false);
  const [squareSize, setSquareSize] = useState(0);

  // Ukur ruang yang tersedia, ambil sisi terkecil (lebar - strip hue - gap, vs tinggi)
  // supaya kotak SV selalu utuh kelihatan, bukan overflow lalu discroll.
  useEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const widthBudget = width - HUE_STRIP_WIDTH - GAP;
      setSquareSize(Math.max(0, Math.min(widthBudget, height)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  function updateHue(clientY: number) {
    const el = hueStripRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = Math.min(rect.height, Math.max(0, clientY - rect.top));
    onChange({ hue: Math.round((y / rect.height) * 360), sat, val });
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

  function handleHueDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingHue.current = true;
    updateHue(e.clientY);
  }

  function handleHueMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingHue.current) return;
    updateHue(e.clientY);
  }

  const currentColor = `hsl(${hue}, ${sat}%, ${val}%)`;

  return (
    <div className="p-3 flex flex-col gap-3 h-full">
      <div ref={fitRef} className="flex-1 min-h-0 flex items-center justify-center gap-2">
        <div
          ref={svRef}
          onPointerDown={handleSvDown}
          onPointerMove={handleSvMove}
          onPointerUp={() => (draggingSv.current = false)}
          className="rounded-md relative cursor-crosshair shrink-0"
          style={{
            width: squareSize,
            height: squareSize,
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

        <div
          ref={hueStripRef}
          onPointerDown={handleHueDown}
          onPointerMove={handleHueMove}
          onPointerUp={() => (draggingHue.current = false)}
          className="rounded-md relative cursor-pointer shrink-0"
          style={{
            width: HUE_STRIP_WIDTH,
            height: squareSize,
            background:
              "linear-gradient(to bottom, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
          }}
        >
          <div
            className="absolute left-0 right-0 h-1 bg-white shadow-sm rounded-sm pointer-events-none"
            style={{ top: `calc(${(hue / 360) * 100}% - 2px)` }}
          />
        </div>
      </div>

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