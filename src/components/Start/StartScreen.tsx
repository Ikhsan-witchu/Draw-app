import { useState, type ChangeEvent } from "react";
import { FilePlus, FolderOpen, PenLine, Sparkles, Clock, X, RotateCcw } from "lucide-react";
import NewImageDialog, { type DocumentSize } from "./NewImageDialog";
import type { RecentProjectMeta } from "../../utils/persistence";

interface StartScreenProps {
  onCreateNew: (size: DocumentSize) => void;
  onOpenImage: (file: File) => void;
  recentProject?: RecentProjectMeta | null;
  onResumeRecent?: () => void;
  onClearRecent?: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return "Baru saja";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDays = Math.floor(diffHour / 24);
  return `${diffDays} hari lalu`;
}

export default function StartScreen({
  onCreateNew,
  onOpenImage,
  recentProject,
  onResumeRecent,
  onClearRecent,
}: StartScreenProps) {
  const [showDialog, setShowDialog] = useState(false);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onOpenImage(file);
    e.target.value = "";
  }

  return (
    <div className="h-full h-dvh w-full bg-neutral-950 flex flex-col items-center justify-center p-6 sm:p-8 overflow-hidden relative select-none">

      {/* ── Background dot grid ── */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* ── Glow accent ── */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(99,102,241,0.08) 0%, transparent 70%)" }}
      />

      {/* ── Logo + branding ── */}
      <div className="relative flex flex-col items-center mb-8 sm:mb-10 animate-fade-in">
        <div className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xl mb-4 sm:mb-5">
          <PenLine size={32} className="text-indigo-400 sm:hidden" />
          <PenLine size={38} className="text-indigo-400 hidden sm:block" />
        </div>
        <h1 className="text-white text-2xl sm:text-3xl font-semibold tracking-tight mb-1">
          Draw<span className="text-indigo-400">App</span>
        </h1>
        <p className="text-neutral-500 text-sm sm:text-base">
          Mulai menggambar — kapan saja, di mana saja.
        </p>
      </div>

      {/* ── Action cards ── */}
      <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full max-w-xs sm:max-w-none sm:w-auto animate-fade-in">

        {/* Lanjutkan Gambar Terakhir (Recent Project Card) */}
        {recentProject && (
          <div
            onClick={onResumeRecent}
            role="button"
            tabIndex={0}
            className="group relative flex flex-row sm:flex-col items-center sm:justify-between gap-4 sm:gap-3 w-full sm:w-52 sm:h-52 p-4 rounded-2xl border border-indigo-500/40 bg-neutral-900/90 hover:border-indigo-400 hover:bg-neutral-850 transition-all duration-200 text-left sm:text-center shadow-xl cursor-pointer ring-1 ring-indigo-500/20 hover:ring-indigo-500/40"
          >
            {/* Dismiss / Hapus Riwayat Button */}
            {onClearRecent && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearRecent();
                }}
                className="absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-full bg-neutral-800/90 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 flex items-center justify-center transition-colors opacity-70 group-hover:opacity-100"
                title="Hapus riwayat karya terakhir"
                aria-label="Hapus riwayat"
              >
                <X size={13} />
              </button>
            )}

            {/* Thumbnail preview */}
            <div className="flex-shrink-0 w-14 h-14 sm:w-full sm:h-24 rounded-xl bg-neutral-950 border border-neutral-800 overflow-hidden flex items-center justify-center relative group-hover:border-indigo-500/40 transition-colors">
              {recentProject.thumbnailDataUrl ? (
                <img
                  src={recentProject.thumbnailDataUrl}
                  alt={recentProject.tab.title}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <RotateCcw size={22} className="text-indigo-400" />
              )}
              {/* Badge resume on thumbnail (desktop) */}
              <div className="hidden sm:flex absolute bottom-1.5 left-1.5 items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-900/90 border border-neutral-700/60 text-[10px] text-indigo-300 font-medium">
                <RotateCcw size={9} />
                <span>Terakhir</span>
              </div>
            </div>

            {/* Info text */}
            <div className="flex-1 min-w-0 pr-6 sm:pr-0 sm:w-full">
              <div className="flex items-center gap-1.5 sm:justify-center">
                <span className="sm:hidden inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                <div className="text-neutral-100 text-sm font-medium truncate">
                  {recentProject.tab.title}
                </div>
              </div>
              <div className="text-indigo-400/90 text-xs font-medium mt-0.5 sm:mt-1 flex items-center gap-1 sm:justify-center">
                <span>{recentProject.tab.width} × {recentProject.tab.height}</span>
                <span>•</span>
                <span>{recentProject.layerCount} layer</span>
              </div>
              <div className="text-neutral-500 text-[11px] mt-0.5 flex items-center gap-1 sm:justify-center">
                <Clock size={10} className="text-neutral-500" />
                <span>{formatRelativeTime(recentProject.updatedAt)}</span>
              </div>
            </div>
          </div>
        )}

        {/* New Image */}
        <button
          onClick={() => setShowDialog(true)}
          className="group flex flex-row sm:flex-col items-center sm:justify-center gap-4 sm:gap-4 w-full sm:w-48 sm:h-52 px-5 py-4 sm:px-6 sm:py-6 rounded-2xl border border-neutral-800 bg-neutral-900 hover:border-indigo-500/50 hover:bg-neutral-800/80 transition-all duration-200 text-left sm:text-center shadow-lg"
        >
          {/* Preview placeholder */}
          <div className="flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-neutral-800 group-hover:bg-neutral-750 border border-neutral-700 flex items-center justify-center transition-colors">
            <FilePlus size={20} className="text-indigo-400" />
          </div>
          <div>
            <div className="text-neutral-100 text-sm font-medium">Kanvas baru</div>
            <div className="text-neutral-500 text-xs mt-0.5">Mulai dari kosong</div>
          </div>
        </button>

        {/* Open Image */}
        <label className="group flex flex-row sm:flex-col items-center sm:justify-center gap-4 sm:gap-4 w-full sm:w-48 sm:h-52 px-5 py-4 sm:px-6 sm:py-6 rounded-2xl border border-neutral-800 bg-neutral-900 hover:border-indigo-500/50 hover:bg-neutral-800/80 transition-all duration-200 text-left sm:text-center shadow-lg cursor-pointer">
          <div className="flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center transition-colors">
            <FolderOpen size={20} className="text-indigo-400" />
          </div>
          <div>
            <div className="text-neutral-100 text-sm font-medium">Buka gambar</div>
            <div className="text-neutral-500 text-xs mt-0.5">Lanjut edit file lama</div>
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>
      </div>

      {/* ── Tips strip ── */}
      <div className="relative mt-8 sm:mt-10 flex items-center gap-2 text-neutral-600 text-xs animate-fade-in">
        <Sparkles size={12} className="text-indigo-600" />
        <span>Supports layers, brush palette, pinch-to-zoom, dan penyimpanan otomatis.</span>
      </div>

      {showDialog && <NewImageDialog onCreate={onCreateNew} onCancel={() => setShowDialog(false)} />}
    </div>
  );
}