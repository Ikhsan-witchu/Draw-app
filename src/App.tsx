import DrawingCanvas from "./components/Canvas/DrawingCanvas";
import DrawingWorkspacePanels from "./components/Tools/Drawing workspace panels";

function App() {
  return (
    <div className="app">
      <DrawingWorkspacePanels />

      <main className="canvas-area">
        <DrawingCanvas />
      </main>
    </div>
  );
}

export default App;