// ─── Hook: Text Tool ────────────────────────────────────────────────────────
// Mengelola state dan logika untuk text tool:
// - Simpan posisi klik (document coords) dan teks yang sedang diketik
// - Commit teks ke layer canvas saat user selesai (tekan Enter atau klik luar)

import { useState, useCallback, useRef, useEffect } from "react";
import type { TabStore, LayerMeta } from "../types/drawing";

export interface TextToolState {
  active: boolean;          // sedang menampilkan text input
  docX: number;             // posisi X di dokumen canvas
  docY: number;             // posisi Y di dokumen canvas
  text: string;             // isi teks sementara
}

interface UseTextToolParams {
  tool: string;
  color: string;
  brushSize: number;        // font size = brushSize * 2 px (min 12, max 256)
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

  const fontSize = Math.max(12, Math.min(256, brushSize * 2));

  /** Mulai mengedit teks di posisi dokumen tertentu */
  const startTextEdit = useCallback(
    (docX: number, docY: number) => {
      if (tool !== "text") return;
      // Jika sudah ada input aktif, commit dulu
      setTextState({ active: true, docX, docY, text: "" });
    },
    [tool],
  );

  /** Commit teks ke layer canvas lalu tutup input */
  const commitText = useCallback(
    (text: string, docX: number, docY: number) => {
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

      ctx.save();
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = color;
      ctx.textBaseline = "top";

      // Render setiap baris (user bisa tekan Shift+Enter untuk multi-line)
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        ctx.fillText(line, docX, docY + i * (fontSize * 1.2));
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

  // Jika tool berganti keluar dari "text", batalkan/commit input yang sedang aktif
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
    startTextEdit,
    commitText,
    cancelText,
    updateText,
  };
}
