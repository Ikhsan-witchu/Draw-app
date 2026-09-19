// ─── Hook: manajemen layer untuk kanvas aktif ─────────────────────────────────

import { type Dispatch, type SetStateAction } from "react";
import type { LayerMeta, TabStore } from "../types/drawing";
import {
  generateId,
  nextAvailableName,
  createLayerCanvas,
  loadImageFromFile,
  loadImageFromUrl,
} from "../utils/canvasUtils";

interface UseLayerManagerParams {
  getActiveStore: () => TabStore | undefined;
  layers: LayerMeta[];
  setLayers: Dispatch<SetStateAction<LayerMeta[]>>;
  activeLayerId: string | null;
  setActiveLayerId: Dispatch<SetStateAction<string | null>>;
  recomposite: () => void;
}

export function useLayerManager({
  getActiveStore,
  layers,
  setLayers,
  activeLayerId,
  setActiveLayerId,
  recomposite,
}: UseLayerManagerParams) {
  function addLayer() {
    const store = getActiveStore();
    if (!store) return;

    const id = generateId("layer");
    const name = nextAvailableName(layers.map((l) => l.name), "Layer");

    store.layerCanvases.set(id, createLayerCanvas(store.width, store.height));
    setLayers((prev) => [{ id, name, visible: true, locked: false }, ...prev]);
    setActiveLayerId(id);
  }

  function deleteLayer(id: string) {
    const store = getActiveStore();
    if (!store || layers.length <= 1) return;

    const deletedLayer = layers.find((l) => l.id === id);
    let next = layers.filter((l) => l.id !== id);

    // Pastikan selalu ada layer bernama "Background" di posisi paling bawah
    if (deletedLayer?.name === "Background" && next.length > 0) {
      const bottomIndex = next.length - 1;
      next = next.map((l, i) => (i === bottomIndex ? { ...l, name: "Background" } : l));
    }

    store.layerCanvases.delete(id);
    store.history.delete(id);
    setLayers(next);

    if (activeLayerId === id) {
      setActiveLayerId(next[0]?.id ?? null);
    }
  }

  function toggleLayerVisibility(id: string) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
  }

  function toggleLayerLock(id: string) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)));
  }

  function selectLayer(id: string) {
    setActiveLayerId(id);
  }

  function reorderLayer(draggedId: string, targetId: string, position: "before" | "after") {
    if (draggedId === targetId) return;

    setLayers((prev) => {
      const dragged = prev.find((l) => l.id === draggedId);
      if (!dragged) return prev;

      const withoutDragged = prev.filter((l) => l.id !== draggedId);
      const targetIndex = withoutDragged.findIndex((l) => l.id === targetId);
      if (targetIndex === -1) return prev;

      const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
      const next = [...withoutDragged];
      next.splice(insertIndex, 0, dragged);
      return next;
    });
  }

  function importImageAsLayer(image: HTMLImageElement, dropX?: number, dropY?: number) {
    const store = getActiveStore();
    if (!store) return;

    const id = generateId("layer");
    const name = nextAvailableName(layers.map((l) => l.name), "Image");
    const layerCanvas = createLayerCanvas(store.width, store.height);

    const ctx = layerCanvas.getContext("2d");
    if (ctx) {
      const w = image.naturalWidth || image.width;
      const h = image.naturalHeight || image.height;
      const x = dropX !== undefined ? dropX - w / 2 : (store.width - w) / 2;
      const y = dropY !== undefined ? dropY - h / 2 : (store.height - h) / 2;

      try {
        ctx.drawImage(image, x, y, w, h);
      } catch {
        // CORS atau error gambar diabaikan
      }
    }

    store.layerCanvases.set(id, layerCanvas);
    setLayers((prev) => [{ id, name, visible: true, locked: false }, ...prev]);
    setActiveLayerId(id);
    recomposite();
  }

  function importImageFromFile(file: File, dropX?: number, dropY?: number) {
    loadImageFromFile(file).then((img) => importImageAsLayer(img, dropX, dropY));
  }

  function importImageFromUrl(url: string, dropX?: number, dropY?: number) {
    loadImageFromUrl(url)
      .then((img) => importImageAsLayer(img, dropX, dropY))
      .catch(() => {
        // CORS error diabaikan
      });
  }

  return {
    addLayer,
    deleteLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    selectLayer,
    reorderLayer,
    importImageAsLayer,
    importImageFromFile,
    importImageFromUrl,
  };
}
