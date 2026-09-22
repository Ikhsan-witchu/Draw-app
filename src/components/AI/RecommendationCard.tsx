import { Check, X, Wrench, Paintbrush, Sliders, Palette, ListOrdered } from "lucide-react";
import type { ToolRecommendation } from "../../types/ai";
import { TOOLS, BRUSHES } from "../Workspace/toolsData";

interface RecommendationCardProps {
  recommendation: ToolRecommendation;
  onApply: (rec: ToolRecommendation) => void;
  onSkip: (rec: ToolRecommendation) => void;
}

export function RecommendationCard({ recommendation, onApply, onSkip }: RecommendationCardProps) {
  const toolItem = TOOLS.find((t) => t.id === recommendation.tool);
  const brushItem = recommendation.brush_type
    ? BRUSHES.find((b) => b.id === recommendation.brush_type)
    : null;

  const isApplied = recommendation.status === "applied";
  const isSkipped = recommendation.status === "skipped";

  return (
    <div className="mt-2.5 rounded-xl border border-neutral-700/80 bg-neutral-900/90 overflow-hidden shadow-lg select-none text-xs">
      {/* Header Kartu */}
      <div className="px-3 py-2 bg-gradient-to-r from-indigo-950/70 to-neutral-800/60 border-b border-neutral-700/60 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
          <Wrench size={13} className="text-indigo-400" />
          <span>Saran Alat & Parameter</span>
        </div>
        {isApplied && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <Check size={10} /> Diterapkan
          </span>
        )}
        {isSkipped && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-700/40 text-neutral-400 border border-neutral-600/40 flex items-center gap-1">
            <X size={10} /> Dilewati
          </span>
        )}
      </div>

      {/* Konten Parameter Tool */}
      <div className="p-3 space-y-2.5">
        {/* Penjelasan Singkat */}
        {recommendation.explanation && (
          <p className="text-neutral-300 leading-relaxed text-[11.5px]">
            {recommendation.explanation}
          </p>
        )}

        {/* Chips Parameter */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {/* Tool Chip */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-200">
            {toolItem?.icon && <toolItem.icon size={12} className="text-indigo-400" />}
            <span className="font-medium">{toolItem?.label || recommendation.tool}</span>
          </div>

          {/* Brush Type Chip */}
          {recommendation.brush_type && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-200">
              <Paintbrush size={12} className="text-pink-400" />
              <span>{brushItem?.label || recommendation.brush_type}</span>
            </div>
          )}

          {/* Size Chip */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-300">
            <span className="text-neutral-500">Ukuran:</span>
            <span className="font-mono text-white font-medium">{recommendation.brush_size_px}px</span>
          </div>

          {/* Opacity Chip */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-300">
            <Sliders size={11} className="text-neutral-400" />
            <span className="text-neutral-500">Opacity:</span>
            <span className="font-mono text-white font-medium">{recommendation.opacity_percent}%</span>
          </div>

          {/* Color Chip */}
          {recommendation.color_hex && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-300">
              <Palette size={11} className="text-neutral-400" />
              <div
                className="w-3.5 h-3.5 rounded-full border border-neutral-600 shadow-inner"
                style={{ backgroundColor: recommendation.color_hex }}
              />
              <span className="font-mono text-[11px] text-neutral-200 uppercase">
                {recommendation.color_hex}
              </span>
            </div>
          )}
        </div>

        {/* Langkah-langkah */}
        {recommendation.steps && recommendation.steps.length > 0 && (
          <div className="mt-2 pt-2 border-t border-neutral-800/80">
            <div className="flex items-center gap-1 text-[11px] font-medium text-neutral-400 mb-1.5">
              <ListOrdered size={12} />
              <span>Langkah pengerjaan:</span>
            </div>
            <ol className="space-y-1 pl-4 list-decimal text-[11px] text-neutral-300">
              {recommendation.steps.map((step, idx) => (
                <li key={idx} className="leading-snug">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Tombol Aksi: Terapkan / Lewati */}
      <div className="px-3 py-2 bg-neutral-950/70 border-t border-neutral-800 flex items-center justify-end gap-2">
        {recommendation.status === "pending" ? (
          <>
            <button
              onClick={() => onSkip(recommendation)}
              className="px-2.5 py-1.5 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors text-[11px] font-medium"
            >
              Lewati
            </button>
            <button
              onClick={() => onApply(recommendation)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow transition-all active:scale-95 text-[11px] flex items-center gap-1.5"
            >
              <Check size={13} />
              Terapkan
            </button>
          </>
        ) : (
          <span className="text-[10px] text-neutral-500 italic">
            {isApplied ? "Saran ini telah diterapkan ke tool Anda." : "Saran ini dilewati."}
          </span>
        )}
      </div>
    </div>
  );
}
