// ─── Tipe & interface bersama untuk fitur drawing ───────────────────────────

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface LayerMeta {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity?: number; // 0 - 100 (persen)
  blendMode?: GlobalCompositeOperation;
}

export interface DocumentTab {
  id: string;
  title: string;
  width: number;
  height: number;
  initialImage?: HTMLImageElement;
}

export interface TabStore {
  width: number;
  height: number;
  layers: LayerMeta[];
  activeLayerId: string | null;
  layerCanvases: Map<string, HTMLCanvasElement>;
  history: Map<string, ImageData[]>;
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
}

export interface UseDrawingCanvasOptions {
  tool: string;
  brushType?: string;
  brushSize?: number;
  brushOpacity?: number; // 1 - 100
  stabilizerStrength?: number; // 0 - 10
  shapeFilled?: boolean;
  color: string;
  tabs: DocumentTab[];
  activeTabId: string | null;
  onColorPick?: (hsl: { hue: number; sat: number; val: number }) => void;
}

export interface PointerInfo {
  id: number;
  clientX: number;
  clientY: number;
  pointerType: string;
}

export interface GestureState {
  initialDist: number;
  initialAngle: number;
  initialMidX: number;
  initialMidY: number;
  startZoom: number;
  startPanX: number;
  startPanY: number;
  startRotation: number;
}

export const MAX_HISTORY = 25;
export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 20;
