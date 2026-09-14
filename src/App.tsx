import { useEffect, useState } from "react";
import DrawingWorkspace from "./components/Workspace/DrawingWorkspace";
import NewDocumentScreen, { type DocumentSize } from "./components/NewDocument/NewDocumentScreen";

function App() {
  const [documentSize, setDocumentSize] = useState<DocumentSize | null>(null);

  // Cegah Ctrl+scroll / pinch-zoom browser nge-zoom seluruh halaman.
  // Zoom kanvas ditangani sendiri di dalam DrawingCanvas, terlepas dari ini.
  useEffect(() => {
    function preventPageZoom(e: WheelEvent) {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    }
    window.addEventListener("wheel", preventPageZoom, { passive: false });
    return () => window.removeEventListener("wheel", preventPageZoom);
  }, []);

  if (!documentSize) {
    return <NewDocumentScreen onCreate={setDocumentSize} />;
  }

  return (
    <DrawingWorkspace
      documentWidth={documentSize.width}
      documentHeight={documentSize.height}
    />
  );
}

export default App;