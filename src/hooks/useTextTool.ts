// ─── Hook: Text Tool ────────────────────────────────────────────────────────
// Mengelola state dan logika untuk text tool:
// - Pengaturan font: ukuran, jenis font, bold, italic, text alignment
// - Render teks presisi ke layer canvas

import { useState, useCallback, useRef, useEffect } from "react";
import type { TabStore, LayerMeta } from "../types/drawing";

export type TextAlign = "left" | "center" | "right";

export interface TextToolState {
  active: boolean;          // sedang menampilkan text input
  docX: number;             // posisi X di dokumen canvas
  docY: number;             // posisi Y di dokumen canvas
  text: string;             // isi teks sementara
}

export interface TextFormatOptions {
  fontSize?: number;
  fontFamily?: string;
  isBold?: boolean;
  isItalic?: boolean;
  align?: TextAlign;
}

interface UseTextToolParams {
  tool: string;
  color: string;
  brushSize: number;
  getActiveStore: () => TabStore | undefined;
  activeLayerId: string | null;
  layers: LayerMeta[];
  pushHistory: () => void;
  recomposite: () => void;
  persistActiveLayerContent: () => void;
}

export function useTextTool({
  tool,
  color,
  brushSize,
  getActiveStore,
  activeLayerId,
  layers,
  pushHistory,
  recomposite,
  persistActiveLayerContent,
}: UseTextToolParams) {
  const [textState, setTextState] = useState<TextToolState>({
    active: false,
    docX: 0,
    docY: 0,
    text: "",
  });

  // Pengaturan format teks
  const [fontSize, setFontSize] = useState<number>(() => Math.max(12, Math.min(300, (brushSize ?? 16) * 2)));
  const [fontFamily, setFontFamily] = useState<string>("sans-serif");
  const [isBold, setIsBold] = useState<boolean>(false);
  const [isItalic, setIsItalic] = useState<boolean>(false);
  const [align, setAlign] = useState<TextAlign>("left");

  // Sinkronkan font size awal dengan brush size jika ukuran teks belum pernah diubah manual
  const hasCustomFontSize = useRef(false);
  useEffect(() => {
    if (!hasCustomFontSize.current && brushSize > 0) {
      setFontSize(Math.max(12, Math.min(300, brushSize * 2)));
    }
  }, [brushSize]);

  const handleSetFontSize = useCallback((size: number) => {
    hasCustomFontSize.current = true;
    setFontSize(Math.max(8, Math.min(300, size)));
  }, []);

  /** Mulai mengedit teks di posisi dokumen tertentu */
  const startTextEdit = useCallback(
    (docX: number, docY: number) => {
      if (tool !== "text") return;
      setTextState({ active: true, docX, docY, text: "" });
    },
    [tool],
  );

  /** Commit teks ke layer canvas lalu tutup input */
  const commitText = useCallback(
    (text: string, docX: number, docY: number, customOptions?: TextFormatOptions) => {
      if (!text.trim()) {
        setTextState((s) => ({ ...s, active: false, text: "" }));
        return;
      }

      const store = getActiveStore();
      if (!store || !activeLayerId) {
        setTextState((s) => ({ ...s, active: false, text: "" }));
        return;
      }

      const activeLayerMeta = layers.find((l) => l.id === activeLayerId);
      if (activeLayerMeta?.locked || !activeLayerMeta?.visible) {
        setTextState((s) => ({ ...s, active: false, text: "" }));
        return;
      }

      const layerCanvas = store.layerCanvases.get(activeLayerId);
      const ctx = layerCanvas?.getContext("2d");
      if (!ctx) {
        setTextState((s) => ({ ...s, active: false, text: "" }));
        return;
      }

      pushHistory();

      const fSize = customOptions?.fontSize ?? fontSize;
      const fFam = customOptions?.fontFamily ?? fontFamily;
      const fBold = customOptions?.isBold ?? isBold;
      const fItalic = customOptions?.isItalic ?? isItalic;
      const fAlign = customOptions?.align ?? align;

      ctx.save();
      const fontStyle = fItalic ? "italic" : "normal";
      const fontWeight = fBold ? "bold" : "normal";
      ctx.font = `${fontStyle} ${fontWeight} ${fSize}px ${fFam}`;
      ctx.fillStyle = color;
      ctx.textBaseline = "top";
      ctx.textAlign = fAlign;

      // Render setiap baris (user bisa tekan Shift+Enter untuk multi-line)
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        ctx.fillText(line, docX, docY + i * (fSize * 1.25));
      });
      ctx.restore();

      recomposite();
      persistActiveLayerContent();

      setTextState({ active: false, docX: 0, docY: 0, text: "" });
    },
    [
      getActiveStore,
      activeLayerId,
      layers,
      pushHistory,
      recomposite,
      persistActiveLayerContent,
      color,
      fontSize,
      fontFamily,
      isBold,
      isItalic,
      align,
    ],
  );

  /** Tutup input tanpa commit */
  const cancelText = useCallback(() => {
    setTextState({ active: false, docX: 0, docY: 0, text: "" });
  }, []);

  /** Update teks sementara (saat user mengetik) */
  const updateText = useCallback((text: string) => {
    setTextState((s) => ({ ...s, text }));
  }, []);

  // Jika tool berganti keluar dari "text", commit input yang sedang aktif
  const textStateRef = useRef(textState);
  useEffect(() => {
    textStateRef.current = textState;
  }, [textState]);

  useEffect(() => {
    if (tool !== "text" && textStateRef.current.active) {
      commitText(textStateRef.current.text, textStateRef.current.docX, textStateRef.current.docY);
    }
  }, [tool, commitText]);

  return {
    textState,
    fontSize,
    fontFamily,
    isBold,
    isItalic,
    align,
    setFontSize: handleSetFontSize,
    setFontFamily,
    setIsBold,
    setIsItalic,
    setAlign,
    startTextEdit,
    commitText,
    cancelText,
    updateText,
  };
}
