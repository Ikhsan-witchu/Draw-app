import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

interface MenuAction {
  type: "action";
  label: string;
  shortcut?: string;
  onClick: () => void;
}

interface MenuCheckbox {
  type: "checkbox";
  label: string;
  checked: boolean;
  onToggle: () => void;
}

export type MenuItemDef = MenuAction | MenuCheckbox;

export interface MenuDef {
  label: string;
  items: MenuItemDef[];
}

interface MenuBarProps {
  menus: MenuDef[];
}

export function MenuBar({ menus }: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenu(null);
    }
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className="flex items-center h-full px-2 gap-0.5">
      {menus.map((menu) => (
        <div key={menu.label} className="relative">
          <button
            onClick={() => setOpenMenu((prev) => (prev === menu.label ? null : menu.label))}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              openMenu === menu.label
                ? "bg-neutral-800 text-white"
                : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
            }`}
          >
            {menu.label}
          </button>

          {openMenu === menu.label && (
            <div className="absolute top-full left-0 mt-1 min-w-[200px] bg-neutral-900 border border-neutral-800 rounded-md shadow-2xl py-1 z-50">
              {menu.items.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    if (item.type === "action") {
                      item.onClick();
                      setOpenMenu(null);
                    } else {
                      item.onToggle();
                    }
                  }}
                  className="w-full flex items-center justify-between gap-6 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors text-left"
                >
                  <span className="flex items-center gap-2">
                    {item.type === "checkbox" && (
                      <span
                        className={`w-3.5 h-3.5 flex items-center justify-center rounded-sm border shrink-0 ${
                          item.checked ? "bg-white border-white" : "border-neutral-600"
                        }`}
                      >
                        {item.checked && <Check size={10} className="text-neutral-900" />}
                      </span>
                    )}
                    {item.label}
                  </span>
                  {item.type === "action" && item.shortcut && (
                    <span className="text-xs text-neutral-500">{item.shortcut}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}