import { useState } from "react";
import { X, Image, FolderArchive, Loader2 } from "lucide-react";

interface SaveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePng: () => void;
  onSaveProject: () => Promise<void>;
  projectTitle: string;
}

export function SaveDialog({ isOpen, onClose, onSavePng, onSaveProject, projectTitle }: SaveDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSaveProject = async () => {
    setIsSaving(true);
    try {
      await onSaveProject();
    } finally {
      setIsSaving(false);
      onClose();
    }
  };

  const handleSavePng = () => {
    onSavePng();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-[380px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <h2 className="text-sm font-semibold text-white">Simpan File</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <p className="text-xs text-neutral-400">
            Pilih format penyimpanan untuk <strong className="text-neutral-200">{projectTitle}</strong>:
          </p>

          {/* Option 1: PNG */}
          <button
            onClick={handleSavePng}
            disabled={isSaving}
            className="w-full flex items-start gap-3 p-3 rounded-lg border border-neutral-700 hover:border-indigo-500/60 hover:bg-neutral-800/80 transition-all text-left group disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center shrink-0 group-hover:border-emerald-600/60">
              <Image size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Ekspor sebagai PNG</p>
              <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                Gambar datar (flat) tanpa layer. Cocok untuk berbagi atau upload ke media sosial.
              </p>
            </div>
          </button>

          {/* Option 2: DWP Project */}
          <button
            onClick={handleSaveProject}
            disabled={isSaving}
            className="w-full flex items-start gap-3 p-3 rounded-lg border border-neutral-700 hover:border-purple-500/60 hover:bg-neutral-800/80 transition-all text-left group disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-950/60 border border-purple-800/40 flex items-center justify-center shrink-0 group-hover:border-purple-600/60">
              {isSaving ? (
                <Loader2 size={20} className="text-purple-400 animate-spin" />
              ) : (
                <FolderArchive size={20} className="text-purple-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                Simpan Proyek (.dwp)
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                Menyimpan seluruh layer, properti, dan frame animasi. Bisa dibuka kembali di Draw App untuk melanjutkan.
              </p>
            </div>
          </button>
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-neutral-800 bg-neutral-950/50">
          <p className="text-[10px] text-neutral-500 text-center">
            Shortcut: Ctrl+S untuk membuka dialog ini
          </p>
        </div>
      </div>
    </div>
  );
}
