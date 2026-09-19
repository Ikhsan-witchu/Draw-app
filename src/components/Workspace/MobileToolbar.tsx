import { useState, useRef, type ChangeEvent } from "react";
import {
  Menu,
  Undo2,
  Download,
  Layers,
  Paintbrush,
  X,
  FilePlus,
  FolderOpen,
  Save,
} from "lucide-react";
import type { ToolItem } from "./types";

interface MobileToolbarProps {
  // Tool selection
  tools: ToolItem[];
  activeTool: string;
  onSelectTool: (id: string) => void;
  // Actions
  onUndo: () => void;
  onSave: () => void;
  onNewFile: () => void;
  onOpenFile: (file: File) => void;
  onCloseTab: () => void;
  // Active color (for swatch display)
  color: string;
  // Panel toggles
  onToggleColor: () => void;
  onToggleBrushes: () => void;
  onToggleLayers: () => void;
  // Tab info
  tabTitle: string;
}

export function MobileToolbar({
  tools,
  activeTool,
  onSelectTool,
  onUndo,
  onSave,
  onNewFile,
  onOpenFile,
  onCloseTab,
  color,
  onToggleColor,
  onToggleBrushes,
  onToggleLayers,
  tabTitle,
}: MobileToolbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onOpenFile(file);
    e.target.value = "";
  }

  return (
    <>
      {/* ── Top bar ── */}
      <div className="h-11 shrink-0 bg-neutral-900 border-b border-neutral-800 flex items-center px-2 gap-1">
        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen((p) => !p)}
          className="p-2 rounded text-neutral-400 hover:text-white hover:bg-neutral-800"
        >
          <Menu size={18} />
        </button>

        {/* Tab title */}
        <span className="flex-1 text-xs text-neutral-300 truncate text-center">
          {tabTitle}
        </span>

        {/* Quick actions */}
        <button
          onClick={onUndo}
          className="p-2 rounded text-neutral-400 hover:text-white hover:bg-neutral-800"
          title="Undo"
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={onSave}
          className="p-2 rounded text-neutral-400 hover:text-white hover:bg-neutral-800"
          title="Save"
        >
          <Download size={16} />
        </button>
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute top-11 left-1 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl py-1 min-w-[180px] z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { onNewFile(); setMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              <FilePlus size={15} /> New
            </button>
            <button
              onClick={() => { fileInputRef.current?.click(); setMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              <FolderOpen size={15} /> Open
            </button>
            <button
              onClick={() => { onSave(); setMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              <Save size={15} /> Save
            </button>
            <div className="border-t border-neutral-800 my-1" />
            <button
              onClick={() => { onCloseTab(); setMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              <X size={15} /> Close
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── Bottom toolbar ── */}
      <div className="shrink-0 bg-neutral-900 border-t border-neutral-800 flex items-center pb-safe">
        {/* Tools strip */}
        <div className="flex-1 flex items-center overflow-x-auto px-1 gap-0.5 h-12">
          {tools.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              title={label}
              onClick={() => onSelectTool(id)}
              className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                activeTool === id
                  ? "bg-white text-neutral-900"
                  : "text-neutral-400 active:bg-neutral-800"
              }`}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-7 bg-neutral-700 shrink-0" />

        {/* Panel toggles */}
        <div className="flex items-center gap-0.5 px-1 shrink-0">
          <button
            onClick={onToggleColor}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-neutral-400 active:bg-neutral-800"
            title="Color"
          >
            <div
              className="w-5 h-5 rounded-full border-2 border-neutral-600"
              style={{ backgroundColor: color }}
            />
          </button>
          <button
            onClick={onToggleBrushes}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-neutral-400 active:bg-neutral-800"
            title="Brush Palette"
          >
            <Paintbrush size={18} />
          </button>
          <button
            onClick={onToggleLayers}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-neutral-400 active:bg-neutral-800"
            title="Layers"
          >
            <Layers size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
