// ─── TextOverlay: Floating textarea dengan Toolbar Format saat Text Tool aktif ──
// Memungkinkan pengguna mengetik teks dengan live styling (ukuran font, font family,
// bold, italic, alignment), tombol ukuran +/- slider, serta tombol Commit / Cancel.

import { useEffect, useRef } from "react";
import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Check,
  X,
  Plus,
  Minus,
} from "lucide-react";
import type { TextAlign } from "../../hooks/useTextTool";

export const FONT_FAMILIES = [
  { label: "Sans-Serif", value: "sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Monospace", value: "Consolas, monospace" },
  { label: "Handwriting", value: "'Caveat', 'Comic Sans MS', cursive" },
  { label: "Impact", value: "Impact, 'Arial Black', sans-serif" },
];

interface TextOverlayProps {
  active: boolean;
  docX: number; // posisi klik di dokumen canvas
  docY: number;
  text: string;
  fontSize: number; // px di dokumen space
  fontFamily?: string;
  isBold?: boolean;
  isItalic?: boolean;
  align?: TextAlign;
  color: string; // CSS color string
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
  canvasWidth: number;
  canvasHeight: number;
  onChange: (text: string) => void;
  onCommit: (text: string) => void;
  onCancel: () => void;
  onFontSizeChange?: (size: number) => void;
  onFontFamilyChange?: (family: string) => void;
  onToggleBold?: () => void;
  onToggleItalic?: () => void;
  onAlignChange?: (align: TextAlign) => void;
}

export function TextOverlay({
  active,
  docX,
  docY,
  text,
  fontSize,
  fontFamily = "sans-serif",
  isBold = false,
  isItalic = false,
  align = "left",
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
  onFontSizeChange,
  onFontFamilyChange,
  onToggleBold,
  onToggleItalic,
  onAlignChange,
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
      className="absolute pointer-events-auto z-50 flex flex-col gap-1.5"
      style={{
        left: leftStyle,
        top: topStyle,
        transformOrigin: align === "center" ? "top center" : align === "right" ? "top right" : "top left",
        transform: align === "center" ? "translateX(-50%)" : align === "right" ? "translateX(-100%)" : undefined,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Floating Text Toolbar di atas input */}
      <div
        className="flex items-center gap-1 bg-neutral-900/95 backdrop-blur-md border border-neutral-700/80 rounded-lg shadow-2xl p-1 text-xs select-none pointer-events-auto text-neutral-300"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Font Family Dropdown */}
        {onFontFamilyChange && (
          <select
            value={fontFamily}
            onChange={(e) => onFontFamilyChange(e.target.value)}
            className="bg-neutral-800 text-[11px] text-neutral-200 rounded px-1.5 py-1 border border-neutral-700 outline-none cursor-pointer hover:bg-neutral-700 transition-colors"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        )}

        <div className="w-px h-4 bg-neutral-700/80" />

        {/* Font Size controls */}
        {onFontSizeChange && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onFontSizeChange(Math.max(8, fontSize - 4))}
              title="Perkecil font"
              className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors active:scale-95"
            >
              <Minus size={11} />
            </button>
            <span className="font-mono text-[11px] px-1 text-white font-medium min-w-[32px] text-center">
              {fontSize}px
            </span>
            <button
              onClick={() => onFontSizeChange(Math.min(300, fontSize + 4))}
              title="Perbesar font"
              className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors active:scale-95"
            >
              <Plus size={11} />
            </button>
          </div>
        )}

        <div className="w-px h-4 bg-neutral-700/80" />

        {/* Bold Toggle */}
        {onToggleBold && (
          <button
            onClick={onToggleBold}
            title="Tebal (Bold)"
            className={`p-1 rounded transition-colors ${
              isBold
                ? "bg-indigo-600 text-white"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
          >
            <Bold size={12} />
          </button>
        )}

        {/* Italic Toggle */}
        {onToggleItalic && (
          <button
            onClick={onToggleItalic}
            title="Miring (Italic)"
            className={`p-1 rounded transition-colors ${
              isItalic
                ? "bg-indigo-600 text-white"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
          >
            <Italic size={12} />
          </button>
        )}

        <div className="w-px h-4 bg-neutral-700/80" />

        {/* Alignment Toggles */}
        {onAlignChange && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onAlignChange("left")}
              title="Rata Kiri"
              className={`p-1 rounded transition-colors ${
                align === "left"
                  ? "bg-neutral-700 text-white"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              }`}
            >
              <AlignLeft size={12} />
            </button>
            <button
              onClick={() => onAlignChange("center")}
              title="Rata Tengah"
              className={`p-1 rounded transition-colors ${
                align === "center"
                  ? "bg-neutral-700 text-white"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              }`}
            >
              <AlignCenter size={12} />
            </button>
            <button
              onClick={() => onAlignChange("right")}
              title="Rata Kanan"
              className={`p-1 rounded transition-colors ${
                align === "right"
                  ? "bg-neutral-700 text-white"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              }`}
            >
              <AlignRight size={12} />
            </button>
          </div>
        )}

        <div className="w-px h-4 bg-neutral-700/80" />

        {/* Commit Button */}
        <button
          onClick={() => onCommit(text)}
          title="Terapkan teks (Enter)"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium transition-all active:scale-95 shadow"
        >
          <Check size={12} />
          <span>OK</span>
        </button>

        {/* Cancel Button */}
        <button
          onClick={onCancel}
          title="Batalkan (Esc)"
          className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 transition-colors active:scale-95"
        >
          <X size={12} />
        </button>
      </div>

      {/* Textarea untuk mengetik dengan live styling */}
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
        placeholder="Ketik teks di sini..."
        rows={Math.max(1, text.split("\n").length)}
        className="resize-none outline-none bg-neutral-900/60 rounded-md p-1.5 shadow-lg border-2 border-dashed border-indigo-500/80 overflow-hidden"
        style={{
          fontSize: `${screenFontSize}px`,
          fontFamily: fontFamily,
          fontWeight: isBold ? "bold" : "normal",
          fontStyle: isItalic ? "italic" : "normal",
          textAlign: align,
          color: color,
          lineHeight: 1.25,
          minWidth: "120px",
          caretColor: color,
          backgroundColor: "rgba(15, 15, 15, 0.45)",
          backdropFilter: "blur(4px)",
        }}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
      />

      {/* Hint kecil di bawah */}
      <div className="text-[10px] text-neutral-400 bg-neutral-950/80 rounded px-1.5 py-0.5 self-start select-none pointer-events-none backdrop-blur-sm">
        Enter ✓ · Shift+Enter (baris baru) · Esc ✕
      </div>
    </div>
  );
}
