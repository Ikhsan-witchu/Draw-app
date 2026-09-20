import { useEffect, useState } from "react";
import DrawingWorkspace from "./components/Workspace/DrawingWorkspace";
import StartScreen from "./components/Start/StartScreen";
import type { DocumentSize } from "./components/Start/NewImageDialog";
import type { DocumentTab } from "./hooks/useDrawingCanvas";
import {
  loadActiveAppState,
  saveActiveAppState,
  clearActiveAppState,
  loadRecentProject,
  clearRecentProject,
  deleteTabLayers,
  type RecentProjectMeta,
} from "./utils/persistence";

// Cari nomor terkecil yang belum dipakai di antara judul tab yang ADA sekarang
function nextAvailableTitle(existingTitles: string[]): string {
  let n = 1;
  while (existingTitles.includes(`Untitled ${n}`)) {
    n++;
  }
  return `Untitled ${n}`;
}

function App() {
  const [tabs, setTabs] = useState<DocumentTab[]>(() => {
    const saved = loadActiveAppState();
    if (saved && Array.isArray(saved.tabs) && saved.tabs.length > 0) {
      return saved.tabs.map((t) => ({
        id: t.id,
        title: t.title,
        width: t.width,
        height: t.height,
      }));
    }
    return [];
  });

  const [activeTabId, setActiveTabId] = useState<string | null>(() => {
    const saved = loadActiveAppState();
    if (saved && saved.activeTabId && saved.tabs?.some((t) => t.id === saved.activeTabId)) {
      return saved.activeTabId;
    }
    if (saved && saved.tabs && saved.tabs.length > 0) {
      return saved.tabs[0].id;
    }
    return null;
  });

  const [recentProject, setRecentProject] = useState<RecentProjectMeta | null>(() => {
    return loadRecentProject();
  });

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
    const tabTitle = title ?? nextAvailableTitle(tabs.map((t) => t.title));
    const newTab: DocumentTab = {
      id,
      title: tabTitle,
      width: size.width,
      height: size.height,
      initialImage,
    };

    // Langsung catat ke persistence agar jika langsung reload tetap ke-restore
    const current = loadActiveAppState();
    const updatedTabs = [
      ...(current?.tabs ?? []),
      {
        id,
        title: tabTitle,
        width: size.width,
        height: size.height,
        layers: [
          { id: "layer-1", name: "Layer 1", visible: true, locked: false },
          { id: "layer-bg", name: "Background", visible: true, locked: false },
        ],
        activeLayerId: "layer-1",
        zoom: 1,
        panX: 0,
        panY: 0,
        rotation: 0,
      },
    ];
    saveActiveAppState({
      ...current,
      activeTabId: id,
      tabs: updatedTabs,
    });

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

  function handleResumeRecent() {
    const recent = loadRecentProject();
    if (!recent) return;

    const resumedTab: DocumentTab = {
      id: recent.tab.id,
      title: recent.tab.title,
      width: recent.tab.width,
      height: recent.tab.height,
    };

    saveActiveAppState({
      activeTabId: recent.tab.id,
      tabs: [recent.tab],
    });

    setTabs([resumedTab]);
    setActiveTabId(recent.tab.id);
  }

  function handleClearRecent() {
    const recent = loadRecentProject();
    if (recent) {
      deleteTabLayers(recent.tab.id);
    }
    clearRecentProject();
    setRecentProject(null);
  }

  function closeTab(id: string) {
    const remaining = tabs.filter((t) => t.id !== id);
    setTabs(remaining);

    // Jangan hapus blob jika tab ini adalah snapshot recentProject untuk Home screen
    const recent = loadRecentProject();
    if (!recent || recent.tab.id !== id) {
      deleteTabLayers(id);
    }

    if (remaining.length === 0) {
      setActiveTabId(null);
      clearActiveAppState();
      // Segarkan state recentProject di Home screen
      setRecentProject(loadRecentProject());
    } else if (activeTabId === id) {
      const nextActive = remaining[remaining.length - 1].id;
      setActiveTabId(nextActive);
      const current = loadActiveAppState();
      if (current) {
        saveActiveAppState({
          ...current,
          activeTabId: nextActive,
          tabs: current.tabs.filter((t) => t.id !== id),
        });
      }
    } else {
      const current = loadActiveAppState();
      if (current) {
        saveActiveAppState({
          ...current,
          tabs: current.tabs.filter((t) => t.id !== id),
        });
      }
    }
  }

  if (tabs.length === 0) {
    return (
      <StartScreen
        onCreateNew={handleCreateNew}
        onOpenImage={handleOpenImage}
        recentProject={recentProject}
        onResumeRecent={handleResumeRecent}
        onClearRecent={handleClearRecent}
      />
    );
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