import { useEffect, useState } from "react";
import DrawingWorkspace from "./components/Workspace/DrawingWorkspace";
import StartScreen from "./components/Start/StartScreen";
import type { DocumentSize } from "./components/Start/NewImageDialog";
import type { DocumentTab } from "./hooks/useDrawingCanvas";

// Cari nomor terkecil yang belum dipakai di antara judul tab yang ADA sekarang
function nextAvailableTitle(existingTitles: string[]): string {
  let n = 1;
  while (existingTitles.includes(`Untitled ${n}`)) {
    n++;
  }
  return `Untitled ${n}`;
}

function App() {
  const [tabs, setTabs] = useState<DocumentTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Cegah Ctrl+scroll / pinch-zoom browser nge-zoom seluruh halaman & UI web.
  useEffect(() => {
    function preventWheel(e: WheelEvent) {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    }
    function preventGesture(e: Event) {
      e.preventDefault();
    }
    window.addEventListener("wheel", preventWheel, { passive: false });
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });
    return () => {
      window.removeEventListener("wheel", preventWheel);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
    };
  }, []);

  function addTab(size: DocumentSize, initialImage?: HTMLImageElement, title?: string) {
    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newTab: DocumentTab = {
      id,
      title: title ?? nextAvailableTitle(tabs.map((t) => t.title)),
      width: size.width,
      height: size.height,
      initialImage,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
  }

  function handleCreateNew(size: DocumentSize) {
    addTab(size);
  }

  function handleOpenImage(file: File) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      addTab({ width: img.naturalWidth, height: img.naturalHeight }, img, file.name);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function closeTab(id: string) {
    const remaining = tabs.filter((t) => t.id !== id);
    setTabs(remaining);
    if (activeTabId === id) {
      setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
    }
  }

  if (tabs.length === 0) {
    return <StartScreen onCreateNew={handleCreateNew} onOpenImage={handleOpenImage} />;
  }

  return (
    <DrawingWorkspace
      tabs={tabs}
      activeTabId={activeTabId}
      onSelectTab={setActiveTabId}
      onCloseTab={closeTab}
      onNewTab={handleCreateNew}
      onOpenTabFile={handleOpenImage}
    />
  );
}

export default App;