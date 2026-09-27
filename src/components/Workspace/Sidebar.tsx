import { useState, useRef, useEffect, type DragEvent, type ReactNode } from "react";
import type { DockZone, DropPosition, PanelId } from "./types";

interface SidebarProps {
  zone: DockZone;
  orientation: "vertical" | "horizontal";
  size: number; // width (px) untuk vertical, height (px) untuk horizontal
  panelIds: PanelId[];
  renderPanel: (id: PanelId) => ReactNode;
  onDropPanel: (zone: DockZone, panelId: PanelId, position: DropPosition) => void;
  isDragOver: boolean;
  setDragOverZone: (zone: DockZone | null) => void;
}

export function Sidebar({
  zone,
  orientation,
  size,
  panelIds,
  renderPanel,
  onDropPanel,
  isDragOver,
  setDragOverZone,
}: SidebarProps) {
  const isVertical = orientation === "vertical";
  const containerRef = useRef<HTMLDivElement>(null);

  // Simpan relative flex size tiap panel
  const [panelSizes, setPanelSizes] = useState<Record<string, number>>({});

  // State untuk resizing
  const [resizingIndex, setResizingIndex] = useState<number | null>(null);
  const resizeStartData = useRef<{
    startPos: number;
    totalSize: number;
    startFlexA: number;
    startFlexB: number;
    sumFlex: number;
    panelA: string;
    panelB: string;
  } | null>(null);

  // Pastikan panel yang baru ditambahkan punya flex default 1 (opsional, fallback di style)
  const getFlex = (id: string) => panelSizes[id] ?? 1;

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (resizingIndex === null || !resizeStartData.current) return;
      const data = resizeStartData.current;

      const currentPos = isVertical ? e.clientY : e.clientX;
      const deltaPx = currentPos - data.startPos;

      const allFlexes = panelIds.map(getFlex);
      const totalFlex = allFlexes.reduce((a, b) => a + b, 0);
      
      const deltaFlex = (deltaPx / data.totalSize) * totalFlex;

      let newFlexA = data.startFlexA + deltaFlex;
      let newFlexB = data.startFlexB - deltaFlex;

      // Batasan minimal size (misal min 10% atau 0.1 flex)
      const minFlex = totalFlex * 0.1;
      if (newFlexA < minFlex) {
        newFlexA = minFlex;
        newFlexB = data.sumFlex - minFlex;
      } else if (newFlexB < minFlex) {
        newFlexB = minFlex;
        newFlexA = data.sumFlex - minFlex;
      }

      setPanelSizes(prev => ({
        ...prev,
        [data.panelA]: newFlexA,
        [data.panelB]: newFlexB,
      }));
    }

    function handleMouseUp() {
      setResizingIndex(null);
      resizeStartData.current = null;
      document.body.style.cursor = '';
    }

    if (resizingIndex !== null) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = isVertical ? 'row-resize' : 'col-resize';
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [resizingIndex, isVertical, panelIds]);

  const handleResizeStart = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    
    const panelA = panelIds[index];
    const panelB = panelIds[index + 1];
    
    resizeStartData.current = {
      startPos: isVertical ? e.clientY : e.clientX,
      totalSize: isVertical ? containerRef.current.clientHeight : containerRef.current.clientWidth,
      startFlexA: getFlex(panelA),
      startFlexB: getFlex(panelB),
      sumFlex: getFlex(panelA) + getFlex(panelB),
      panelA,
      panelB,
    };
    setResizingIndex(index);
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex bg-neutral-900 shrink-0 overflow-hidden ${isVertical ? "flex-col" : "flex-row"}`}
      style={isVertical ? { width: size } : { height: size }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOverZone(zone);
      }}
      onDragLeave={() => setDragOverZone(null)}
      onDrop={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const panelId = e.dataTransfer.getData("text/plain") as PanelId;
        const rect = e.currentTarget.getBoundingClientRect();
        const position: DropPosition = isVertical
          ? e.clientY - rect.top < rect.height / 2
            ? "start"
            : "end"
          : e.clientX - rect.left < rect.width / 2
            ? "start"
            : "end";
        onDropPanel(zone, panelId, position);
      }}
    >
      {isDragOver && (
        <div
          className="absolute inset-0 border-2 border-dashed border-neutral-600 pointer-events-none z-10"
          style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
        />
      )}
      {panelIds.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-xs text-neutral-600">
          Drop panel here
        </div>
      )}
      {panelIds.map((id, index) => {
        const flexValue = getFlex(id);
        const isLast = index === panelIds.length - 1;

        return (
          <div
            key={id}
            className={`flex flex-col relative ${isVertical ? '' : 'h-full'}`}
            style={{ 
              flex: `${flexValue} 1 0%`, 
              minWidth: 0, 
              minHeight: 0,
              // If it's a vertical sidebar, items go flex-col and flex-basis handles height.
              // But wait, the parent `div` has `flex-col` if isVertical=true, and `flex-row` if isVertical=false.
              // So for horizontal (flex-row), the panels stack left-to-right. Their width is controlled by flex.
            }}
          >
            {/* Splitter ditaruh di sisi atas/kiri panel KECUALI panel pertama, ATAU di bawah/kanan panel kecuali yang terakhir */}
            {/* Kita pakai setelah panel (kanan/bawah) kecuali yang terakhir */}
            <div className="flex-1 overflow-hidden h-full">
              {renderPanel(id)}
            </div>
            
            {!isLast && (
              <div
                onMouseDown={(e) => handleResizeStart(index, e)}
                className={`absolute z-20 select-none group flex items-center justify-center
                  ${isVertical 
                    ? "h-2.5 -bottom-1.5 left-0 right-0 cursor-row-resize" 
                    : "w-2.5 -right-1.5 top-0 bottom-0 cursor-col-resize"
                  }
                `}
              >
                <div 
                  className={`transition-colors duration-150 ${
                    resizingIndex === index 
                      ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" 
                      : "bg-neutral-800 group-hover:bg-neutral-500"
                  } ${isVertical ? "h-[1px] w-full" : "w-[1px] h-full"}`}
                />
                {/* Indikator taktil (grip pill) */}
                <div
                  className={`absolute rounded-full transition-all duration-150 pointer-events-none ${
                    resizingIndex === index
                      ? "bg-blue-400 opacity-100 " + (isVertical ? "h-1 w-7 scale-x-110" : "w-1 h-7 scale-y-110")
                      : "bg-neutral-600 opacity-0 group-hover:opacity-100 group-hover:bg-neutral-400 " + (isVertical ? "h-1 w-7" : "w-1 h-7")
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}