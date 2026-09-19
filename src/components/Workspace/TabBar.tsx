import { FileImage, Plus, X } from "lucide-react";
import type { DocumentTab } from "../../hooks/useDrawingCanvas";

interface TabBarProps {
  tabs: DocumentTab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onAddTab: () => void;
}

export function TabBar({ tabs, activeTabId, onSelectTab, onCloseTab, onAddTab }: TabBarProps) {
  return (
    <div className="h-10 shrink-0 bg-neutral-950 border-b border-neutral-800 flex items-stretch overflow-x-auto no-scrollbar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onSelectTab(tab.id)}
          className={`flex items-center gap-2 px-3 border-r border-neutral-800 cursor-pointer shrink-0 min-w-[160px] max-w-[240px] transition-colors ${
            tab.id === activeTabId
              ? "bg-neutral-800 text-white"
              : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
          }`}
        >
          <FileImage size={14} className="shrink-0 opacity-70" />
          <div className="flex-1 min-w-0 flex flex-col leading-tight py-1">
            <span className="text-xs truncate">{tab.title}</span>
            <span className="text-[10px] text-neutral-500">
              {tab.width} × {tab.height}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCloseTab(tab.id);
            }}
            title="Tutup tab"
            className="p-0.5 rounded hover:bg-neutral-700 hover:text-white text-neutral-500 shrink-0"
          >
            <X size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={onAddTab}
        title="Tab baru"
        className="px-3 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-neutral-900 transition-colors shrink-0"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}