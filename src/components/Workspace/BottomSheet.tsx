import { X } from "lucide-react";
import type { ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

      {/* Sheet */}
      <div
        className="relative bg-neutral-900 rounded-t-3xl max-h-[80vh] flex flex-col animate-slide-up border-t border-neutral-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex flex-col items-center pt-3 pb-0 shrink-0">
          <div className="w-10 h-1 rounded-full bg-neutral-600 mb-3" />
        </div>

        {/* Title row */}
        <div className="flex items-center justify-between px-4 pb-3 shrink-0 border-b border-neutral-800">
          <span className="text-neutral-200 text-sm font-semibold">{title}</span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-safe touch-pan-y">
          {children}
        </div>
      </div>
    </div>
  );
}
