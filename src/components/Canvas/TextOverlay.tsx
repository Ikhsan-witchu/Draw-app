// ─── TextOverlay: Floating textarea saat Text Tool aktif ────────────────────
// Diposisikan di atas viewport, tepat di titik klik user (sudah di-transform
// untuk zoom/pan). User mengetik lalu tekan Enter untuk commit, Escape untuk cancel.

import { useEffect, useRef } from "react";

interface TextOverlayProps {
  active: boolean;
  docX: number;                // posisi klik di dokumen canvas
  docY: number;
  text: string;
  fontSize: number;            // px di dokumen space
  color: string;               // CSS color string
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
  canvasWidth: number;
  canvasHeight: number;
  onChange: (text: string) => void;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

export function TextOverlay({
  active,
  docX,
  docY,
  text,
  fontSize,
  color,
  zoom,
  panX,
  panY,
  rotation,
  canvasWidth,
  canvasHeight,
  onChange,
  onCommit,
  onCancel,
}: TextOverlayProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-focus saat muncul
  useEffect(() => {
    if (active) {
      setTimeout(() => textareaRef.current?.focus(), 10);
    }
  }, [active]);

  if (!active) return null;

  // Hitung offset dari pusat kanvas (50% 50% di viewport)
  const offsetX = (docX - canvasWidth / 2) * zoom;
  const offsetY = (docY - canvasHeight / 2) * zoom;

  // Terapkan rotasi
  const rad = (rotation * Math.PI) / 180;
  const rotX = offsetX * Math.cos(rad) - offsetY * Math.sin(rad);
  const rotY = offsetX * Math.sin(rad) + offsetY * Math.cos(rad);

  // Posisi di layar: 50% + pan + rot
  const leftStyle = `calc(50% + ${panX + rotX}px)`;
  const topStyle = `calc(50% + ${panY + rotY}px)`;

  // Font size di screen = fontSize * zoom
  const screenFontSize = Math.max(8, fontSize * zoom);

  return (
    <div
      className="absolute pointer-events-auto z-50"
      style={{
        left: leftStyle,
        top: topStyle,
        transformOrigin: "top left",
      }}
    >
      {/* Textarea untuk mengetik */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
            return;
          }
          // Enter tanpa Shift → commit
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onCommit(text);
            return;
          }
        }}
        onBlur={() => onCommit(text)}
        rows={1}
        className="resize-none outline-none bg-transparent border-none p-0 m-0 overflow-hidden"
        style={{
          fontSize: `${screenFontSize}px`,
          fontFamily: "sans-serif",
          color: color,
          lineHeight: 1.2,
          minWidth: "4px",
          caretColor: color,
          borderBottom: "2px dashed rgba(99,102,241,0.8)",
          width: "auto",
          whiteSpace: "pre",
          backgroundColor: "rgba(0,0,0,0.08)",
        }}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
      />

      {/* Hint kecil di bawah */}
      <div
        className="text-[10px] text-indigo-300 bg-neutral-900/70 rounded px-1 py-0.5 mt-0.5 select-none pointer-events-none"
        style={{ fontSize: Math.min(11, Math.max(9, screenFontSize * 0.5)) }}
      >
        Enter ✓ · Esc ✕ · Shift+Enter ↵
      </div>
    </div>
  );
}
