import { useState, type ChangeEvent } from "react";
import { FilePlus, FolderOpen } from "lucide-react";
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
    <div className="h-screen w-screen bg-neutral-950 flex items-center justify-center p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <button
          onClick={() => setShowDialog(true)}
          className="w-40 h-44 sm:w-48 sm:h-56 flex flex-col items-center justify-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 hover:border-neutral-600 hover:bg-neutral-800 transition-colors text-neutral-200"
        >
          <FilePlus size={28} />
          <span className="text-sm">New Image</span>
        </button>

        <label className="w-40 h-44 sm:w-48 sm:h-56 flex flex-col items-center justify-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 hover:border-neutral-600 hover:bg-neutral-800 transition-colors text-neutral-200 cursor-pointer">
          <FolderOpen size={28} />
          <span className="text-sm">Open Image</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>
      </div>

      {showDialog && <NewImageDialog onCreate={onCreateNew} onCancel={() => setShowDialog(false)} />}
    </div>
  );
}