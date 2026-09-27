// ─── TimelinePanel: UI Panel Timeline Animasi (Pixelorama / Aseprite style) ───
// Menampilkan kontrol playback animasi (Play/Pause, First, Prev, Next, Last),
// pengatur FPS, toggle Onion Skinning, daftar track frame, serta tombol Add/Delete/Duplicate frame.

import { useRef, useEffect, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  Trash2,
  Repeat,
  Layers,
  Film,
} from "lucide-react";
import type { AnimationFrame, LayerMeta } from "../../types/drawing";

interface TimelinePanelProps {
  frames: AnimationFrame[];
  currentFrameIndex: number;
  fps: number;
  isPlaying: boolean;
  isLooping: boolean;
  onionSkinEnabled: boolean;
  layers: LayerMeta[];
  canvasWidth: number;
  canvasHeight: number;
  onSelectFrame: (index: number) => void;
  onAddFrame: () => void;
  onDuplicateFrame: () => void;
  onDeleteFrame: (index?: number) => void;
  onNextFrame: () => void;
  onPrevFrame: () => void;
  onFirstFrame: () => void;
  onLastFrame: () => void;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onToggleOnionSkin: () => void;
  onFpsChange: (fps: number) => void;
}

// Komponen thumbnail frame mini
function FrameThumbnail({
  frame,
  layers,
  canvasWidth,
  canvasHeight,
}: {
  frame: AnimationFrame;
  layers: LayerMeta[];
  canvasWidth: number;
  canvasHeight: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Background putih tipis
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Komposit layer yang visible dari frame ini ke thumbnail
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.visible) continue;
      const layerCanvas = frame.layerCanvases.get(layer.id);
      if (layerCanvas) {
        ctx.globalAlpha = (layer.opacity ?? 100) / 100;
        ctx.globalCompositeOperation = layer.blendMode ?? "source-over";
        ctx.drawImage(layerCanvas, 0, 0, canvas.width, canvas.height);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }, [frame, layers, canvasWidth, canvasHeight]);

  return (
    <canvas
      ref={canvasRef}
      width={48}
      height={48}
      className="w-12 h-12 rounded bg-neutral-950 object-contain shadow-inner border border-neutral-700/60"
    />
  );
}

export function TimelinePanel({
  frames,
  currentFrameIndex,
  fps,
  isPlaying,
  isLooping,
  onionSkinEnabled,
  layers,
  canvasWidth,
  canvasHeight,
  onSelectFrame,
  onAddFrame,
  onDuplicateFrame,
  onDeleteFrame,
  onNextFrame,
  onPrevFrame,
  onFirstFrame,
  onLastFrame,
  onTogglePlay,
  onToggleLoop,
  onToggleOnionSkin,
  onFpsChange,
}: TimelinePanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showFpsSlider, setShowFpsSlider] = useState(false);

  // Auto-scroll ke frame aktif saat berganti
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const activeEl = container.querySelector(`[data-frame-index="${currentFrameIndex}"]`) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [currentFrameIndex]);

  return (
    <div className="flex flex-col h-full bg-neutral-900 text-neutral-200 select-none overflow-hidden">
      {/* ── Toolbar Kontrol Timeline ── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-800 bg-neutral-900/95 text-xs gap-2 shrink-0 flex-wrap">
        {/* Playback Controls */}
        <div className="flex items-center gap-1">
          {/* First Frame */}
          <button
            onClick={onFirstFrame}
            title="Frame Pertama (First Frame)"
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors active:scale-95 cursor-pointer"
          >
            <SkipBack size={13} />
          </button>

          {/* Previous Frame */}
          <button
            onClick={onPrevFrame}
            title="Frame Sebelumnya (Prev Frame)"
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors active:scale-95 cursor-pointer"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Play / Pause Toggle */}
          <button
            onClick={onTogglePlay}
            title={isPlaying ? "Pause Animasi (Space)" : "Putar Animasi (Space)"}
            className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all shadow-md active:scale-90 cursor-pointer ${
              isPlaying
                ? "bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold"
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>

          {/* Next Frame */}
          <button
            onClick={onNextFrame}
            title="Frame Berikutnya (Next Frame)"
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors active:scale-95 cursor-pointer"
          >
            <ChevronRight size={14} />
          </button>

          {/* Last Frame */}
          <button
            onClick={onLastFrame}
            title="Frame Terakhir (Last Frame)"
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors active:scale-95 cursor-pointer"
          >
            <SkipForward size={13} />
          </button>

          {/* Loop Toggle */}
          <button
            onClick={onToggleLoop}
            title={isLooping ? "Looping: Aktif" : "Looping: Nonaktif"}
            className={`p-1 rounded ml-0.5 transition-colors cursor-pointer ${
              isLooping
                ? "text-indigo-400 bg-indigo-950/60 border border-indigo-800/60"
                : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
            }`}
          >
            <Repeat size={13} />
          </button>

          {/* Frame Indicator Badge */}
          <div className="flex items-center gap-1 ml-1.5 px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px] text-neutral-300">
            <Film size={11} className="text-indigo-400" />
            <span className="font-semibold text-white">{currentFrameIndex + 1}</span>
            <span className="text-neutral-500">/</span>
            <span>{frames.length}</span>
          </div>
        </div>

        {/* FPS & Settings Controls */}
        <div className="flex items-center gap-2">
          {/* FPS Speed Control */}
          <div className="relative flex items-center gap-1 bg-neutral-800/80 px-2 py-0.5 rounded-lg border border-neutral-700/80">
            <span className="text-[11px] text-neutral-400 font-medium">Speed:</span>
            <button
              onClick={() => onFpsChange(Math.max(1, fps - 1))}
              className="text-neutral-400 hover:text-white px-1 font-bold active:scale-90 cursor-pointer"
              title="Perlambat FPS"
            >
              -
            </button>
            <button
              onClick={() => setShowFpsSlider((p) => !p)}
              className="font-mono text-[11px] text-white font-semibold hover:text-indigo-300 cursor-pointer"
              title="Klik untuk ubah slider FPS"
            >
              {fps.toFixed(1)} FPS
            </button>
            <button
              onClick={() => onFpsChange(Math.min(30, fps + 1))}
              className="text-neutral-400 hover:text-white px-1 font-bold active:scale-90 cursor-pointer"
              title="Percepat FPS"
            >
              +
            </button>

            {/* Floating FPS Slider */}
            {showFpsSlider && (
              <div
                className="absolute top-full mt-1.5 right-0 z-50 bg-neutral-900 border border-neutral-700 rounded-lg p-2.5 shadow-2xl flex flex-col gap-2 min-w-[150px]"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center text-[11px] text-neutral-400">
                  <span>Kecepatan Animasi</span>
                  <span className="font-mono text-white font-bold">{fps} FPS</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={0.5}
                  value={fps}
                  onChange={(e) => onFpsChange(Number(e.target.value))}
                  className="w-full h-1.5 accent-indigo-500 bg-neutral-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span>1 FPS</span>
                  <span>12 FPS</span>
                  <span>30 FPS</span>
                </div>
              </div>
            )}
          </div>

          {/* Onion Skinning Toggle */}
          <button
            onClick={onToggleOnionSkin}
            title={onionSkinEnabled ? "Onion Skin: Aktif" : "Onion Skin: Nonaktif"}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-all active:scale-95 cursor-pointer ${
              onionSkinEnabled
                ? "bg-amber-600/20 text-amber-300 border-amber-500/60 shadow"
                : "bg-neutral-800 hover:bg-neutral-750 text-neutral-400 hover:text-white border-neutral-700"
            }`}
          >
            <Layers size={13} className={onionSkinEnabled ? "text-amber-400" : "text-neutral-400"} />
            <span className="hidden sm:inline">Onion Skin</span>
          </button>

          <div className="w-px h-4 bg-neutral-800" />

          {/* Frame Actions (Add, Duplicate, Delete) */}
          <div className="flex items-center gap-1">
            <button
              onClick={onAddFrame}
              title="Tambah Frame Kosong (+)"
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all active:scale-95 shadow cursor-pointer"
            >
              <Plus size={13} />
              <span className="hidden sm:inline">Frame</span>
            </button>

            <button
              onClick={onDuplicateFrame}
              title="Duplikat Frame Aktif"
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition-all active:scale-95 cursor-pointer"
            >
              <Copy size={13} />
            </button>

            <button
              onClick={() => onDeleteFrame()}
              disabled={frames.length <= 1}
              title={frames.length <= 1 ? "Minimal harus ada 1 frame" : "Hapus Frame Aktif"}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-rose-950/60 hover:border-rose-700 hover:text-rose-400 text-neutral-400 border border-neutral-700 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Frame Strip / Track (Daftar Kotak Frame) ── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-2.5 flex items-center gap-2 bg-neutral-950/50"
      >
        {frames.map((frame, index) => {
          const isActive = index === currentFrameIndex;

          return (
            <div
              key={frame.id}
              data-frame-index={index}
              onClick={() => onSelectFrame(index)}
              className={`group relative flex flex-col items-center p-1.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
                isActive
                  ? "bg-indigo-950/50 border-indigo-500 shadow-lg ring-2 ring-indigo-500/20"
                  : "bg-neutral-900 hover:bg-neutral-850 border-neutral-800 hover:border-neutral-700 opacity-80 hover:opacity-100"
              }`}
            >
              {/* Header Kotak Frame: Nomor Frame */}
              <div className="flex items-center justify-between w-full mb-1 px-1">
                <span
                  className={`font-mono text-[10px] font-bold ${
                    isActive ? "text-indigo-400" : "text-neutral-400"
                  }`}
                >
                  #{index + 1}
                </span>

                {/* Quick delete on hover */}
                {frames.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFrame(index);
                    }}
                    title="Hapus frame ini"
                    className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-rose-400 transition-opacity p-0.5"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>

              {/* Thumbnail Frame */}
              <FrameThumbnail
                frame={frame}
                layers={layers}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
              />
            </div>
          );
        })}

        {/* Tombol Add Frame di ujung kanan track */}
        <button
          onClick={onAddFrame}
          title="Tambah Frame Baru"
          className="flex flex-col items-center justify-center w-16 h-[74px] rounded-xl border-2 border-dashed border-neutral-800 hover:border-indigo-500 hover:bg-indigo-950/20 text-neutral-500 hover:text-indigo-400 transition-all cursor-pointer shrink-0"
        >
          <Plus size={18} />
          <span className="text-[10px] font-medium mt-1">Tambah</span>
        </button>
      </div>
    </div>
  );
}
