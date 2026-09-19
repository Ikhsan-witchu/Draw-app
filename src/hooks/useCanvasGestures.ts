// ─── Hook: gesture multi-sentuh & pointer events ibis Paint-style ────────────

import { useRef, useEffect, type RefObject, type PointerEvent as ReactPointerEvent } from "react";
import type { GestureState, PointerInfo, TabStore, LayerMeta } from "../types/drawing";
import { ZOOM_MIN, ZOOM_MAX } from "../types/drawing";

interface UseCanvasGesturesParams {
  viewportRef: RefObject<HTMLDivElement | null>;
  tool: string;

  // Transform state
  zoomRef: RefObject<number>;
  panXRef: RefObject<number>;
  panYRef: RefObject<number>;
  rotationRef: RefObject<number>;
  setZoom: (v: number) => void;
  setPanX: (v: number) => void;
  setPanY: (v: number) => void;
  setRotation: (v: number) => void;

  // Akses ke data aktif
  getActiveStore: () => TabStore | undefined;
  layers: LayerMeta[];
  activeLayerId: string | null;

  // Callback drawing
  isDrawable: boolean;
  docPointFromClient: (clientX: number, clientY: number) => { x: number; y: number };
  pushHistory: () => void;
  drawStrokeSegment: (
    from: { x: number; y: number; pressure: number },
    to: { x: number; y: number; pressure: number },
  ) => void;
  handleBucketFill: (clientX: number, clientY: number) => void;
  handleEyedropperPick: (clientX: number, clientY: number) => void;
  recomposite: () => void;
}

export function useCanvasGestures({
  viewportRef,
  tool,
  zoomRef,
  panXRef,
  panYRef,
  rotationRef,
  setZoom,
  setPanX,
  setPanY,
  setRotation,
  getActiveStore,
  layers,
  activeLayerId,
  isDrawable,
  docPointFromClient,
  pushHistory,
  drawStrokeSegment,
  handleBucketFill,
  handleEyedropperPick,
  recomposite,
}: UseCanvasGesturesParams) {
  const activePointers = useRef<Map<number, PointerInfo>>(new Map());
  const isGestureActive = useRef(false);
  const ignoreUntilAllUp = useRef(false);
  const strokePreSnapshot = useRef<ImageData | null>(null);
  const gestureState = useRef<GestureState | null>(null);

  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number; pressure: number } | null>(null);
  const isMousePanning = useRef(false);
  const mousePanStart = useRef({ clientX: 0, clientY: 0, startPanX: 0, startPanY: 0 });

  // ── Mouse wheel zoom dengan anchor point ──────────────────────────────────
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();

      const curZoom = zoomRef.current;
      const factor = Math.exp(-e.deltaY * 0.001);
      const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, curZoom * factor));

      const vRect = viewport!.getBoundingClientRect();
      const viewCenterX = vRect.left + vRect.width / 2;
      const viewCenterY = vRect.top + vRect.height / 2;

      const vx = e.clientX - (viewCenterX + panXRef.current);
      const vy = e.clientY - (viewCenterY + panYRef.current);
      const zoomRatio = nextZoom / curZoom;

      setZoom(nextZoom);
      setPanX(panXRef.current + vx * (1 - zoomRatio));
      setPanY(panYRef.current + vy * (1 - zoomRatio));
    }

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Revert stroke yang sedang berjalan (waktu jari kedua turun) ───────────
  function revertInProgressStroke() {
    if (!isDrawing.current || !strokePreSnapshot.current) return;

    isDrawing.current = false;
    lastPoint.current = null;

    const store = getActiveStore();
    if (store && activeLayerId) {
      const layerCanvas = store.layerCanvases.get(activeLayerId);
      const ctx = layerCanvas?.getContext("2d");
      if (ctx && strokePreSnapshot.current) {
        ctx.putImageData(strokePreSnapshot.current, 0, 0);
        recomposite();
      }

      // Hapus entry history yang baru saja ditambahkan
      const stack = store.history.get(activeLayerId);
      if (stack && stack.length > 0) stack.pop();
    }

    strokePreSnapshot.current = null;
  }

  // ── Mulai gesture 2 jari ──────────────────────────────────────────────────
  function beginGesture() {
    const pts = Array.from(activePointers.current.values());
    const p1 = pts[0];
    const p2 = pts[1];

    const dist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
    const angle = Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX);
    const midX = (p1.clientX + p2.clientX) / 2;
    const midY = (p1.clientY + p2.clientY) / 2;

    gestureState.current = {
      initialDist: Math.max(dist, 10),
      initialAngle: angle,
      initialMidX: midX,
      initialMidY: midY,
      startZoom: zoomRef.current,
      startPanX: panXRef.current,
      startPanY: panYRef.current,
      startRotation: rotationRef.current,
    };
  }

  // ── Pointer Down ─────────────────────────────────────────────────────────
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();

    activePointers.current.set(e.pointerId, {
      id: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      pointerType: e.pointerType,
    });

    if (ignoreUntilAllUp.current) return;

    // Mouse middle-click atau tool "move" → pan desktop
    if (e.pointerType === "mouse" && (e.button === 1 || tool === "move")) {
      isMousePanning.current = true;
      mousePanStart.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        startPanX: panXRef.current,
        startPanY: panYRef.current,
      };
      return;
    }

    // 2 jari atau lebih → gesture mode (ibis Paint-style)
    if (activePointers.current.size >= 2) {
      revertInProgressStroke();
      isGestureActive.current = true;
      beginGesture();
      return;
    }

    // 1 jari / klik kiri mouse
    if (activePointers.current.size === 1) {
      if (e.button !== 0 && e.pointerType === "mouse") return;

      const store = getActiveStore();
      if (!store) return;

      const docPt = docPointFromClient(e.clientX, e.clientY);
      const isInsideCanvas =
        docPt.x >= 0 && docPt.x <= store.width &&
        docPt.y >= 0 && docPt.y <= store.height;

      if (!isInsideCanvas) return;

      if (tool === "bucket") {
        handleBucketFill(e.clientX, e.clientY);
        return;
      }

      if (tool === "eyedropper") {
        handleEyedropperPick(e.clientX, e.clientY);
        return;
      }

      if (!isDrawable || !activeLayerId) return;

      const activeLayerMeta = layers.find((l) => l.id === activeLayerId);
      if (activeLayerMeta?.locked || !activeLayerMeta?.visible) return;

      // Simpan snapshot sebelum stroke untuk keperluan revert gesture
      const layerCanvas = store.layerCanvases.get(activeLayerId);
      const ctx = layerCanvas?.getContext("2d");
      if (ctx && layerCanvas) {
        strokePreSnapshot.current = ctx.getImageData(0, 0, layerCanvas.width, layerCanvas.height);
      }

      pushHistory();
      isDrawing.current = true;

      const startPt = {
        x: docPt.x,
        y: docPt.y,
        pressure: e.pressure > 0 ? e.pressure : 0.5,
      };
      lastPoint.current = startPt;
      drawStrokeSegment(startPt, startPt);
    }
  };

  // ── Pointer Move ─────────────────────────────────────────────────────────
  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, {
        id: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        pointerType: e.pointerType,
      });
    }

    // Pan mouse desktop
    if (isMousePanning.current) {
      const deltaX = e.clientX - mousePanStart.current.clientX;
      const deltaY = e.clientY - mousePanStart.current.clientY;
      setPanX(mousePanStart.current.startPanX + deltaX);
      setPanY(mousePanStart.current.startPanY + deltaY);
      return;
    }

    // Gesture 2 jari: pinch-zoom, pan, rotate
    if (isGestureActive.current && activePointers.current.size >= 2) {
      const pts = Array.from(activePointers.current.values());
      const p1 = pts[0];
      const p2 = pts[1];

      const dist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
      const angle = Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX);
      const midX = (p1.clientX + p2.clientX) / 2;
      const midY = (p1.clientY + p2.clientY) / 2;

      const gs = gestureState.current;
      if (!gs) return;

      const scaleFactor = dist / gs.initialDist;
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, gs.startZoom * scaleFactor));

      // Snap ke sudut bulat (0°, 90°, 180°, 270°)
      const angleDiffDeg = ((angle - gs.initialAngle) * 180) / Math.PI;
      let newRotation = (gs.startRotation + angleDiffDeg) % 360;
      const normalized = ((newRotation % 360) + 360) % 360;
      if (normalized < 3.5 || normalized > 356.5) newRotation = 0;
      else if (Math.abs(normalized - 90) < 3.5) newRotation = 90;
      else if (Math.abs(normalized - 180) < 3.5) newRotation = 180;
      else if (Math.abs(normalized - 270) < 3.5) newRotation = 270;

      const deltaMidX = midX - gs.initialMidX;
      const deltaMidY = midY - gs.initialMidY;

      const viewport = viewportRef.current;
      if (viewport) {
        const vRect = viewport.getBoundingClientRect();
        const viewCenterX = vRect.left + vRect.width / 2;
        const viewCenterY = vRect.top + vRect.height / 2;

        const vx = gs.initialMidX - (viewCenterX + gs.startPanX);
        const vy = gs.initialMidY - (viewCenterY + gs.startPanY);
        const zoomRatio = newZoom / gs.startZoom;

        setZoom(newZoom);
        setRotation(newRotation);
        setPanX(gs.startPanX + deltaMidX + vx * (1 - zoomRatio));
        setPanY(gs.startPanY + deltaMidY + vy * (1 - zoomRatio));
      }
      return;
    }

    // Drawing stroke satu jari
    if (!ignoreUntilAllUp.current && isDrawing.current && activePointers.current.size === 1 && activeLayerId) {
      const activeLayerMeta = layers.find((l) => l.id === activeLayerId);
      if (activeLayerMeta?.locked || !activeLayerMeta?.visible) return;

      const pt = docPointFromClient(e.clientX, e.clientY);
      const currentPt = { x: pt.x, y: pt.y, pressure: e.pressure > 0 ? e.pressure : 0.5 };

      if (lastPoint.current) {
        drawStrokeSegment(lastPoint.current, currentPt);
      }
      lastPoint.current = currentPt;
    }
  };

  // ── Pointer Up ───────────────────────────────────────────────────────────
  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId);

    if (isMousePanning.current) {
      isMousePanning.current = false;
    }

    if (isGestureActive.current && activePointers.current.size < 2) {
      isGestureActive.current = false;
      gestureState.current = null;
      ignoreUntilAllUp.current = true;
    }

    if (activePointers.current.size === 0) {
      isDrawing.current = false;
      lastPoint.current = null;
      strokePreSnapshot.current = null;
      ignoreUntilAllUp.current = false;
    }
  };

  return { handlePointerDown, handlePointerMove, handlePointerUp };
}
