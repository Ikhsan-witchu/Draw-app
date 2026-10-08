import { useState, useEffect, useCallback } from "react";
import { MAX_HISTORY } from "../types/drawing";
import { createLayerCanvas } from "../utils/canvasUtils";
import type { TabStore } from "../types/drawing";

interface UseHistoryOptions {
  activeTabId: string | null;
  activeLayerId: string | null;
  getActiveStore: () => TabStore | undefined;
  scratchCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  recomposite: () => void;
  persistActiveLayerContent: () => void;
}

export function useHistory({
  activeTabId,
  activeLayerId,
  getActiveStore,
  scratchCanvasRef,
  recomposite,
  persistActiveLayerContent,
}: UseHistoryOptions) {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Perbarui status canUndo / canRedo saat layer atau tab berganti
  useEffect(() => {
    const store = getActiveStore();
    if (!store || !activeLayerId) {
      setCanUndo(false);
      setCanRedo(false);
      return;
    }
    const undoStack = store.history.get(activeLayerId);
    const redoStack = store.redoHistory?.get(activeLayerId);
    setCanUndo((undoStack?.length ?? 0) > 0);
    setCanRedo((redoStack?.length ?? 0) > 0);
  }, [activeLayerId, activeTabId, getActiveStore]);

  const pushHistory = useCallback(() => {
    const store = getActiveStore();
    if (!store || !activeLayerId) return;

    const layerCanvas = store.layerCanvases.get(activeLayerId);
    if (!layerCanvas) return;

    // Kloning kanvas via drawImage murni di GPU (Texture blit ~0.3ms)
    const copy = createLayerCanvas(layerCanvas.width, layerCanvas.height);
    const copyCtx = copy.getContext("2d");
    copyCtx?.drawImage(layerCanvas, 0, 0);

    const stack = store.history.get(activeLayerId) ?? [];
    stack.push(copy);
    if (stack.length > MAX_HISTORY) stack.shift();
    store.history.set(activeLayerId, stack);

    // Saat aksi baru dilakukan, bersihkan stack Redo
    if (!store.redoHistory) {
      store.redoHistory = new Map();
    }
    store.redoHistory.set(activeLayerId, []);

    setCanUndo(true);
    setCanRedo(false);
  }, [activeLayerId, getActiveStore]);

  const handleUndo = useCallback(() => {
    const store = getActiveStore();
    if (!store || !activeLayerId) return;

    const layerCanvas = store.layerCanvases.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!ctx || !layerCanvas) return;

    const stack = store.history.get(activeLayerId);
    const snapshot = stack?.pop();
    if (snapshot) {
      // Simpan kondisi saat ini ke stack Redo sebelum ditimpa
      const redoCopy = createLayerCanvas(layerCanvas.width, layerCanvas.height);
      const redoCtx = redoCopy.getContext("2d");
      redoCtx?.drawImage(layerCanvas, 0, 0);

      if (!store.redoHistory) {
        store.redoHistory = new Map();
      }
      const redoStack = store.redoHistory.get(activeLayerId) ?? [];
      redoStack.push(redoCopy);
      if (redoStack.length > MAX_HISTORY) redoStack.shift();
      store.redoHistory.set(activeLayerId, redoStack);

      scratchCanvasRef.current = null;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
      ctx.drawImage(snapshot, 0, 0);
      recomposite();
      persistActiveLayerContent();

      setCanUndo((stack?.length ?? 0) > 0);
      setCanRedo(true);
    }
  }, [activeLayerId, getActiveStore, persistActiveLayerContent, recomposite, scratchCanvasRef]);

  const handleRedo = useCallback(() => {
    const store = getActiveStore();
    if (!store || !activeLayerId) return;

    const layerCanvas = store.layerCanvases.get(activeLayerId);
    const ctx = layerCanvas?.getContext("2d");
    if (!ctx || !layerCanvas) return;

    const redoStack = store.redoHistory?.get(activeLayerId);
    const snapshot = redoStack?.pop();
    if (snapshot) {
      // Simpan kondisi saat ini ke stack Undo sebelum ditimpa
      const undoCopy = createLayerCanvas(layerCanvas.width, layerCanvas.height);
      const undoCtx = undoCopy.getContext("2d");
      undoCtx?.drawImage(layerCanvas, 0, 0);

      const undoStack = store.history.get(activeLayerId) ?? [];
      undoStack.push(undoCopy);
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
      store.history.set(activeLayerId, undoStack);

      scratchCanvasRef.current = null;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
      ctx.drawImage(snapshot, 0, 0);
      recomposite();
      persistActiveLayerContent();

      setCanUndo(true);
      setCanRedo((redoStack?.length ?? 0) > 0);
    }
  }, [activeLayerId, getActiveStore, persistActiveLayerContent, recomposite, scratchCanvasRef]);

  return { canUndo, canRedo, pushHistory, handleUndo, handleRedo };
}
