// ─── Hook: Manajemen Timeline Animasi (Frame-based Animation) ─────────────────
// Mendukung penambahan, duplikasi, penghapusan frame, navigasi, pengaturan FPS,
// playback loop berbasis requestAnimationFrame, serta fitur Onion Skinning.

import { useState, useEffect, useRef, useCallback } from "react";
import type { AnimationFrame, LayerMeta, TabStore } from "../types/drawing";
import { createLayerCanvas, generateId } from "../utils/canvasUtils";

interface UseAnimationTimelineProps {
  getActiveStore: () => TabStore | undefined;
  recomposite: () => void;
  activeTabId: string | null;
  layers: LayerMeta[];
  canvasWidth: number;
  canvasHeight: number;
}

export function useAnimationTimeline({
  getActiveStore,
  recomposite,
  activeTabId,
  layers,
  canvasWidth,
  canvasHeight,
}: UseAnimationTimelineProps) {
  const [frames, setFrames] = useState<AnimationFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [fps, setFps] = useState(6.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [onionSkinEnabled, setOnionSkinEnabled] = useState(false);
  const [onionSkinOpacity, setOnionSkinOpacity] = useState(0.35);

  const isPlayingRef = useRef(isPlaying);
  const currentFrameIndexRef = useRef(currentFrameIndex);
  const fpsRef = useRef(fps);
  const isLoopingRef = useRef(isLooping);
  const framesRef = useRef(frames);

  isPlayingRef.current = isPlaying;
  currentFrameIndexRef.current = currentFrameIndex;
  fpsRef.current = fps;
  isLoopingRef.current = isLooping;
  framesRef.current = frames;

  // Inisialisasi frame store saat tab pertama kali dimuat atau berganti
  useEffect(() => {
    const store = getActiveStore();
    if (!store) return;

    if (!store.frames || store.frames.length === 0) {
      // Buat frame pertama dari layerCanvases yang ada
      const initialFrame: AnimationFrame = {
        id: generateId("frame"),
        name: "Frame 1",
        layerCanvases: store.layerCanvases,
      };
      store.frames = [initialFrame];
      store.currentFrameIndex = 0;
      store.fps = store.fps ?? 6.0;
      store.onionSkinEnabled = store.onionSkinEnabled ?? false;
    }

    setFrames([...store.frames]);
    setCurrentFrameIndex(store.currentFrameIndex ?? 0);
    setFps(store.fps ?? 6.0);
    setOnionSkinEnabled(store.onionSkinEnabled ?? false);
    setIsPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  // Sinkronisasi perubahan state ke store
  useEffect(() => {
    const store = getActiveStore();
    if (store) {
      store.frames = frames;
      store.currentFrameIndex = currentFrameIndex;
      store.fps = fps;
      store.onionSkinEnabled = onionSkinEnabled;
    }
  }, [frames, currentFrameIndex, fps, onionSkinEnabled, getActiveStore]);

  // Pastikan canvas untuk layer baru tersedia di semua frame
  useEffect(() => {
    const store = getActiveStore();
    if (!store || !store.frames) return;

    for (const frame of store.frames) {
      for (const layer of layers) {
        if (!frame.layerCanvases.has(layer.id)) {
          const newCanvas = createLayerCanvas(canvasWidth, canvasHeight);
          if (layer.name === "Background") {
            const ctx = newCanvas.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            }
          }
          frame.layerCanvases.set(layer.id, newCanvas);
        }
      }
    }
  }, [layers, canvasWidth, canvasHeight, getActiveStore]);

  // ── Fungsi Switch / Pilih Frame ──
  const selectFrame = useCallback(
    (index: number) => {
      const store = getActiveStore();
      if (!store || !store.frames || index < 0 || index >= store.frames.length) return;

      const targetFrame = store.frames[index];
      if (!targetFrame) return;

      // Pastikan semua layer yang terdaftar ada di targetFrame
      for (const layer of store.layers) {
        if (!targetFrame.layerCanvases.has(layer.id)) {
          const newCanvas = createLayerCanvas(store.width, store.height);
          if (layer.name === "Background") {
            const ctx = newCanvas.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, store.width, store.height);
            }
          }
          targetFrame.layerCanvases.set(layer.id, newCanvas);
        }
      }

      // Tautkan layerCanvases di store ke targetFrame
      store.layerCanvases = targetFrame.layerCanvases;
      store.currentFrameIndex = index;

      setCurrentFrameIndex(index);
      recomposite();
    },
    [getActiveStore, recomposite]
  );

  // ── Tambah Frame Baru ──
  const addFrame = useCallback(
    (duplicateCurrent = false) => {
      const store = getActiveStore();
      if (!store) return;

      const currentFrames = store.frames ?? frames;
      const curIdx = currentFrameIndexRef.current;
      const currentFrame = currentFrames[curIdx];

      const newFrameId = generateId("frame");
      const newFrameName = `Frame ${currentFrames.length + 1}`;
      const newLayerCanvases = new Map<string, HTMLCanvasElement>();

      for (const layer of store.layers) {
        const layerCanvas = createLayerCanvas(store.width, store.height);
        const ctx = layerCanvas.getContext("2d");

        if (duplicateCurrent && currentFrame) {
          const srcCanvas = currentFrame.layerCanvases.get(layer.id);
          if (srcCanvas && ctx) {
            ctx.drawImage(srcCanvas, 0, 0);
          }
        } else if (layer.name === "Background" && ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, store.width, store.height);
        }
        newLayerCanvases.set(layer.id, layerCanvas);
      }

      const newFrame: AnimationFrame = {
        id: newFrameId,
        name: newFrameName,
        layerCanvases: newLayerCanvases,
      };

      const nextFrames = [...currentFrames];
      const insertIndex = curIdx + 1;
      nextFrames.splice(insertIndex, 0, newFrame);

      store.frames = nextFrames;
      setFrames(nextFrames);

      // Otomatis pilih frame yang baru dibuat
      selectFrame(insertIndex);
    },
    [getActiveStore, frames, selectFrame]
  );

  // ── Duplikasi Frame Aktif ──
  const duplicateFrame = useCallback(() => {
    addFrame(true);
  }, [addFrame]);

  // ── Hapus Frame ──
  const deleteFrame = useCallback(
    (indexToDelete?: number) => {
      const store = getActiveStore();
      if (!store || !store.frames || store.frames.length <= 1) return;

      const targetIdx = indexToDelete ?? currentFrameIndexRef.current;
      const nextFrames = store.frames.filter((_, idx) => idx !== targetIdx);

      store.frames = nextFrames;
      setFrames(nextFrames);

      const nextIdx = Math.min(targetIdx, nextFrames.length - 1);
      selectFrame(nextIdx);
    },
    [getActiveStore, selectFrame]
  );

  // ── Navigasi Frame ──
  const nextFrame = useCallback(() => {
    const total = framesRef.current.length;
    if (total <= 1) return;
    const nextIdx = (currentFrameIndexRef.current + 1) % total;
    selectFrame(nextIdx);
  }, [selectFrame]);

  const prevFrame = useCallback(() => {
    const total = framesRef.current.length;
    if (total <= 1) return;
    const prevIdx = (currentFrameIndexRef.current - 1 + total) % total;
    selectFrame(prevIdx);
  }, [selectFrame]);

  const firstFrame = useCallback(() => {
    selectFrame(0);
  }, [selectFrame]);

  const lastFrame = useCallback(() => {
    const total = framesRef.current.length;
    if (total > 0) {
      selectFrame(total - 1);
    }
  }, [selectFrame]);

  // ── Playback Logic (requestAnimationFrame) ──
  const play = useCallback(() => {
    if (framesRef.current.length <= 1) return;
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
    } else {
      play();
    }
  }, [play, pause]);

  useEffect(() => {
    if (!isPlaying) return;

    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const interval = 1000 / Math.max(1, fpsRef.current);
      const elapsed = now - lastTime;

      if (elapsed >= interval) {
        lastTime = now - (elapsed % interval);
        const total = framesRef.current.length;
        if (total > 1) {
          const cur = currentFrameIndexRef.current;
          const next = cur + 1;

          if (next >= total) {
            if (isLoopingRef.current) {
              selectFrame(0);
            } else {
              setIsPlaying(false);
              return;
            }
          } else {
            selectFrame(next);
          }
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, selectFrame]);

  // ── Toggle Onion Skin ──
  const toggleOnionSkin = useCallback(() => {
    setOnionSkinEnabled((prev) => !prev);
  }, []);

  // ── Reorder Frame (Drag & Drop) ──
  const reorderFrames = useCallback(
    (fromIndex: number, toIndex: number) => {
      const store = getActiveStore();
      if (!store || !store.frames || fromIndex === toIndex) return;

      const updated = [...store.frames];
      const [removed] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, removed);

      store.frames = updated;
      setFrames(updated);

      if (currentFrameIndexRef.current === fromIndex) {
        selectFrame(toIndex);
      } else {
        const cur = currentFrameIndexRef.current;
        if (fromIndex < cur && toIndex >= cur) {
          setCurrentFrameIndex(cur - 1);
        } else if (fromIndex > cur && toIndex <= cur) {
          setCurrentFrameIndex(cur + 1);
        }
      }
    },
    [getActiveStore, selectFrame]
  );

  return {
    frames,
    currentFrameIndex,
    fps,
    isPlaying,
    isLooping,
    onionSkinEnabled,
    onionSkinOpacity,
    setFps,
    setIsLooping,
    setOnionSkinEnabled,
    setOnionSkinOpacity,
    selectFrame,
    addFrame,
    duplicateFrame,
    deleteFrame,
    nextFrame,
    prevFrame,
    firstFrame,
    lastFrame,
    play,
    pause,
    togglePlay,
    toggleOnionSkin,
    reorderFrames,
  };
}
