import { useState } from "react";

export interface DocumentSize {
  width: number;
  height: number;
}

interface NewDocumentScreenProps {
  onCreate: (size: DocumentSize) => void;
}

const PRESETS: Array<DocumentSize & { label: string }> = [
  { label: "Persegi", width: 1080, height: 1080 },
  { label: "Potret", width: 1080, height: 1350 },
  { label: "Lanskap", width: 1920, height: 1080 },
  { label: "A4 Potret (300 DPI)", width: 2480, height: 3508 },
  { label: "A4 Lanskap (300 DPI)", width: 3508, height: 2480 },
];

export default function NewDocumentScreen({ onCreate }: NewDocumentScreenProps) {
  const [customWidth, setCustomWidth] = useState(1600);
  const [customHeight, setCustomHeight] = useState(1200);

  return (
    <div className="h-screen w-screen bg-neutral-950 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-neutral-200 text-lg mb-1">Dokumen baru</h1>
        <p className="text-neutral-500 text-sm mb-6">
          Pilih ukuran kanvas untuk mulai menggambar. Ukuran piksel kanvas akan mengikuti pilihan ini.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => onCreate({ width: preset.width, height: preset.height })}
              className="text-left p-4 rounded-md border border-neutral-800 bg-neutral-900 hover:border-neutral-600 hover:bg-neutral-800 transition-colors"
            >
              <div className="text-neutral-200 text-sm">{preset.label}</div>
              <div className="text-neutral-500 text-xs mt-1">
                {preset.width} × {preset.height} px
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 rounded-md border border-neutral-800 bg-neutral-900">
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
                className="w-28 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-200"
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
                className="w-28 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-200"
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