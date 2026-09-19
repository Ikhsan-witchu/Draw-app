import { useState, type ChangeEvent } from "react";
import { FilePlus, FolderOpen, PenLine, Sparkles } from "lucide-react";
import NewImageDialog, { type DocumentSize } from "./NewImageDialog";

interface StartScreenProps {
  onCreateNew: (size: DocumentSize) => void;
  onOpenImage: (file: File) => void;
}

export default function StartScreen({ onCreateNew, onOpenImage }: StartScreenProps) {
  const [showDialog, setShowDialog] = useState(false);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onOpenImage(file);
    e.target.value = "";
  }

  return (
    <div className="h-screen w-screen bg-neutral-950 flex flex-col items-center justify-center p-6 sm:p-8 overflow-hidden relative select-none">

      {/* ── Background dot grid ── */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* ── Glow accent ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(99,102,241,0.08) 0%, transparent 70%)" }}
      />

      {/* ── Logo + branding ── */}
      <div className="relative flex flex-col items-center mb-10 sm:mb-12 animate-fade-in">
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
      <div className="relative flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-xs sm:max-w-none sm:w-auto animate-fade-in">

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
      <div className="relative mt-10 sm:mt-12 flex items-center gap-2 text-neutral-600 text-xs animate-fade-in">
        <Sparkles size={12} className="text-indigo-600" />
        <span>Supports layers, brush palette, pinch-to-zoom, dan lebih banyak lagi.</span>
      </div>

      {showDialog && <NewImageDialog onCreate={onCreateNew} onCancel={() => setShowDialog(false)} />}
    </div>
  );
}