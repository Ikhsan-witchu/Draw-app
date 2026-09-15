import { useEffect, useState } from "react";
import DrawingWorkspace from "./components/Workspace/DrawingWorkspace";
import StartScreen from "./components/Start/StartScreen";
import type { DocumentSize } from "./components/Start/NewImageDialog";

interface OpenedDocument {
  width: number;
  height: number;
  initialImage?: HTMLImageElement;
}

function App() {
  const [doc, setDoc] = useState<OpenedDocument | null>(null);

  // Cegah Ctrl+scroll / pinch-zoom browser nge-zoom seluruh halaman.
  useEffect(() => {
    function preventPageZoom(e: WheelEvent) {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    }
    window.addEventListener("wheel", preventPageZoom, { passive: false });
    return () => window.removeEventListener("wheel", preventPageZoom);
  }, []);

  function handleCreateNew(size: DocumentSize) {
    setDoc({ width: size.width, height: size.height });
  }

  function handleOpenImage(file: File) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setDoc({ width: img.naturalWidth, height: img.naturalHeight, initialImage: img });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  if (!doc) {
    return <StartScreen onCreateNew={handleCreateNew} onOpenImage={handleOpenImage} />;
  }

  return (
    <DrawingWorkspace
      documentWidth={doc.width}
      documentHeight={doc.height}
      initialImage={doc.initialImage}
      onClose={() => setDoc(null)}
    />
  );
}

export default App;