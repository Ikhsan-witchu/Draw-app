import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { TabBar } from "../Workspace/TabBar.tsx";
import type { DocumentTab } from "../../hooks/useDrawingCanvas";

interface DrawingCanvasProps {
  viewportRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onPointerDown: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  onDrop: (e: ReactDragEvent<HTMLCanvasElement>) => void;
  onDragOver: (e: ReactDragEvent<HTMLCanvasElement>) => void;
  tabs: DocumentTab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onAddTab: () => void;
  /** Hide the tab bar (used on mobile where tabs are managed elsewhere). */
  hideTabBar?: boolean;
}

export default function DrawingCanvas({
  viewportRef,
  canvasRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDrop,
  onDragOver,
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onAddTab,
  hideTabBar = false,
}: DrawingCanvasProps) {
  return (
    <div className="w-full h-full min-w-0 min-h-0 flex flex-col">
      {!hideTabBar && (
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={onSelectTab}
          onCloseTab={onCloseTab}
          onAddTab={onAddTab}
        />
      )}

      <div ref={viewportRef} className="flex-1 min-h-0 overflow-auto">
        <div className={`min-w-full min-h-full flex items-center justify-center ${hideTabBar ? "p-2" : "p-6"}`}>
          <canvas
            ref={canvasRef}
            className="bg-white rounded-sm shadow-2xl touch-none block"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onDrop={onDrop}
            onDragOver={onDragOver}
          />
        </div>
      </div>
    </div>
  );
}