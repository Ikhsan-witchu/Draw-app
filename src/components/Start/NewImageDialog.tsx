import { useState } from "react";
import { X } from "lucide-react";

export interface DocumentSize {
  width: number;
  height: number;
}

interface NewImageDialogProps {
  onCreate: (size: DocumentSize) => void;
  onCancel: () => void;
}

const PRESETS: Array<DocumentSize & { label: string }> = [
  { label: "Persegi", width: 1080, height: 1080 },
  { label: "Potret", width: 1080, height: 1350 },
  { label: "Lanskap", width: 1920, height: 1080 },
  { label: "A4 Potret (300 DPI)", width: 2480, height: 3508 },
  { label: "A4 Lanskap (300 DPI)", width: 3508, height: 2480 },
];

export default function NewImageDialog({ onCreate, onCancel }: NewImageDialogProps) {
  const [customWidth, setCustomWidth] = useState(1600);
  const [customHeight, setCustomHeight] = useState(1200);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 sm:p-8 z-50" onClick={onCancel}>
      <div
        className="w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto touch-pan-y"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-neutral-200 text-base sm:text-lg">Dokumen baru</h1>
          <button onClick={onCancel} title="Tutup" className="text-neutral-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <p className="text-neutral-500 text-xs sm:text-sm mb-4 sm:mb-6">
          Pilih ukuran kanvas untuk mulai menggambar. Ukuran piksel kanvas akan mengikuti pilihan ini.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => onCreate({ width: preset.width, height: preset.height })}
              className="text-left p-3 sm:p-4 rounded-md border border-neutral-800 bg-neutral-900 hover:border-neutral-600 hover:bg-neutral-800 transition-colors"
            >
              <div className="text-neutral-200 text-sm">{preset.label}</div>
              <div className="text-neutral-500 text-xs mt-0.5">
                {preset.width} × {preset.height} px
              </div>
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-4 rounded-md border border-neutral-800 bg-neutral-900">
          <div className="text-neutral-200 text-sm mb-3">Ukuran custom</div>
          <div className="flex items-end gap-3 flex-wrap">
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              Lebar (px)
              <input
                type="number"
                min={64}
                max={8000}
                value={customWidth}
                onChange={(e) => setCustomWidth(Number(e.target.value))}
                className="w-24 sm:w-28 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-200"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              Tinggi (px)
              <input
                type="number"
                min={64}
                max={8000}
                value={customHeight}
                onChange={(e) => setCustomHeight(Number(e.target.value))}
                className="w-24 sm:w-28 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-200"
              />
            </label>
            <button
              onClick={() => onCreate({ width: customWidth, height: customHeight })}
              className="ml-auto px-4 py-2 rounded-md bg-white text-neutral-900 text-sm hover:bg-neutral-200 transition-colors"
            >
              Buat kanvas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}