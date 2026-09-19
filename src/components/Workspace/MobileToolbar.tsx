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
  ChevronRight,
} from "lucide-react";
import type { ToolItem } from "./types";
import { BrushSizeControl } from "./BrushSizeControl";

interface MobileToolbarProps {
  tools: ToolItem[];
  activeTool: string;
  onSelectTool: (id: string) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  onUndo: () => void;
  onSave: () => void;
  onNewFile: () => void;
  onOpenFile: (file: File) => void;
  onCloseTab: () => void;
  color: string;
  onToggleColor: () => void;
  onToggleBrushes: () => void;
  onToggleLayers: () => void;
  tabTitle: string;
}

export function MobileToolbar({
  tools,
  activeTool,
  onSelectTool,
  brushSize,
  onBrushSizeChange,
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

  const activeToolItem = tools.find((t) => t.id === activeTool);

  return (
    <>
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="relative z-30 h-12 shrink-0 bg-neutral-900/95 border-b border-neutral-800 flex items-center px-2 gap-1 backdrop-blur-sm">

        {/* Hamburger menu */}
        <button
          onClick={() => setMenuOpen((p) => !p)}
          className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 active:bg-neutral-700 transition-colors"
        >
          <Menu size={18} />
        </button>

        {/* Tab title — klik untuk rename (disabled for now, just display) */}
        <div className="flex-1 flex items-center gap-1.5 min-w-0 px-1">
          <span className="text-neutral-300 text-xs font-medium truncate leading-none">
            {tabTitle || "Untitled"}
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onUndo}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 active:bg-neutral-700 transition-colors"
            title="Undo"
          >
            <Undo2 size={17} />
          </button>

          <BrushSizeControl
            size={brushSize}
            onChange={onBrushSizeChange}
            color={color}
            isEraser={activeTool === "eraser"}
            compact={true}
          />

          <button
            onClick={onSave}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 active:bg-neutral-700 transition-colors"
            title="Simpan"
          >
            <Download size={17} />
          </button>
        </div>
      </div>

      {/* ── Dropdown menu ──────────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute top-12 left-1 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl py-1.5 min-w-[200px] z-50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <MenuItem icon={<FilePlus size={15} />} label="New" onPress={() => { onNewFile(); setMenuOpen(false); }} />
            <MenuItem icon={<FolderOpen size={15} />} label="Open" onPress={() => { fileInputRef.current?.click(); setMenuOpen(false); }} />
            <MenuItem icon={<Save size={15} />} label="Save" onPress={() => { onSave(); setMenuOpen(false); }} />
            <div className="border-t border-neutral-800 my-1" />
            <MenuItem icon={<X size={15} />} label="Close" onPress={() => { onCloseTab(); setMenuOpen(false); }} danger />
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

      {/* ── Bottom toolbar ─────────────────────────────────────────────────── */}
      <div className="relative z-30 shrink-0 bg-neutral-900/95 border-t border-neutral-800 backdrop-blur-sm pb-safe">
        <div className="flex items-stretch h-14">

          {/* Tool strip — scrollable */}
          <div className="flex-1 flex items-center overflow-x-auto no-scrollbar px-1 gap-0.5 min-w-0">
            {tools.map(({ id, icon: Icon, label }) => {
              const isActive = activeTool === id;
              return (
                <button
                  key={id}
                  title={label}
                  onClick={() => onSelectTool(id)}
                  className={`shrink-0 flex flex-col items-center justify-center gap-0.5 w-11 h-11 rounded-xl transition-all duration-150 ${
                    isActive
                      ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                      : "text-neutral-400 active:bg-neutral-800"
                  }`}
                >
                  <Icon size={17} />
                  {isActive && (
                    <span className="text-[8px] leading-none text-white/80 font-medium truncate max-w-[38px]">
                      {label.split(" ")[0]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Separator */}
          <div className="w-px bg-neutral-800 my-2.5 shrink-0" />

          {/* Panel toggles */}
          <div className="flex items-center gap-0.5 px-1.5 shrink-0">

            {/* Color swatch button */}
            <button
              onClick={onToggleColor}
              className="flex flex-col items-center justify-center gap-0.5 w-11 h-11 rounded-xl active:bg-neutral-800 transition-colors"
              title="Color"
            >
              <div
                className="w-6 h-6 rounded-full border-2 border-neutral-600 shadow-md"
                style={{ backgroundColor: color }}
              />
              <span className="text-[8px] text-neutral-500 leading-none">Warna</span>
            </button>

            {/* Brush palette */}
            <button
              onClick={onToggleBrushes}
              className="flex flex-col items-center justify-center gap-0.5 w-11 h-11 rounded-xl text-neutral-400 active:bg-neutral-800 transition-colors"
              title="Brush Palette"
            >
              <Paintbrush size={17} />
              <span className="text-[8px] text-neutral-500 leading-none">Brush</span>
            </button>

            {/* Layers */}
            <button
              onClick={onToggleLayers}
              className="flex flex-col items-center justify-center gap-0.5 w-11 h-11 rounded-xl text-neutral-400 active:bg-neutral-800 transition-colors"
              title="Layers"
            >
              <Layers size={17} />
              <span className="text-[8px] text-neutral-500 leading-none">Layer</span>
            </button>
          </div>
        </div>

        {/* Active tool + brush size mini info strip */}
        {activeToolItem && (
          <button
            type="button"
            onClick={onToggleBrushes}
            className="flex items-center gap-2 px-3 pb-1 w-full text-left active:opacity-75 transition-opacity"
            title="Buka Brush Palette & Pengaturan Ukuran"
          >
            <activeToolItem.icon size={10} className="text-indigo-400 shrink-0" />
            <span className="text-[10px] text-neutral-400 leading-none">
              {activeToolItem.label}
            </span>
            <ChevronRight size={9} className="text-neutral-600 shrink-0" />
            <span className="text-[10px] text-indigo-400 font-medium leading-none">
              Size {brushSize}px
            </span>
          </button>
        )}
      </div>
    </>
  );
}

// ── Helper component ───────────────────────────────────────────────────────────

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

function MenuItem({ icon, label, onPress, danger }: MenuItemProps) {
  return (
    <button
      onClick={onPress}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
        danger
          ? "text-red-400 hover:bg-red-500/10"
          : "text-neutral-300 hover:bg-neutral-800"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
