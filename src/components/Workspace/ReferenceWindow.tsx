import { useState, useRef, useEffect } from "react";
import { X, Image as ImageIcon, Maximize } from "lucide-react";

interface ReferenceWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReferenceWindow({ isOpen, onClose }: ReferenceWindowProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 300, height: 250 });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  // Image pan & zoom state
  const [imgPan, setImgPan] = useState({ x: 0, y: 0 });
  const [imgZoom, setImgZoom] = useState(1);
  
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  
  const isResizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  
  const isImagePanning = useRef(false);
  const imagePanStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleGlobalMove = (e: PointerEvent) => {
      if (isDragging.current) {
        setPosition({
          x: dragStart.current.px + (e.clientX - dragStart.current.x),
          y: dragStart.current.py + (e.clientY - dragStart.current.y),
        });
      } else if (isResizing.current) {
        setSize({
          width: Math.max(150, resizeStart.current.w + (e.clientX - resizeStart.current.x)),
          height: Math.max(100, resizeStart.current.h + (e.clientY - resizeStart.current.y)),
        });
      }
    };
    
    const handleGlobalUp = () => {
      isDragging.current = false;
      isResizing.current = false;
    };

    if (isOpen) {
      window.addEventListener("pointermove", handleGlobalMove);
      window.addEventListener("pointerup", handleGlobalUp);
    }
    
    return () => {
      window.removeEventListener("pointermove", handleGlobalMove);
      window.removeEventListener("pointerup", handleGlobalUp);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Window drag
  const handleDragStart = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, px: position.x, py: position.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Window resize
  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    isResizing.current = true;
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Image pan & zoom
  const handleImagePointerDown = (e: React.PointerEvent) => {
    if (!imageUrl) return;
    e.stopPropagation();
    isImagePanning.current = true;
    imagePanStart.current = { x: e.clientX, y: e.clientY, px: imgPan.x, py: imgPan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleImagePointerMove = (e: React.PointerEvent) => {
    if (!isImagePanning.current) return;
    e.stopPropagation();
    setImgPan({
      x: imagePanStart.current.px + (e.clientX - imagePanStart.current.x),
      y: imagePanStart.current.py + (e.clientY - imagePanStart.current.y),
    });
  };

  const handleImagePointerUp = (e: React.PointerEvent) => {
    if (isImagePanning.current) {
      isImagePanning.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!imageUrl) return;
    e.stopPropagation();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setImgZoom((z) => Math.max(0.1, Math.min(10, z * zoomFactor)));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setImgPan({ x: 0, y: 0 });
      setImgZoom(1);
    }
  };

  const resetZoomPan = () => {
    setImgPan({ x: 0, y: 0 });
    setImgZoom(1);
  };

  return (
    <div
      className="fixed z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl overflow-hidden flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
    >
      {/* Header */}
      <div 
        className="h-8 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between px-2 cursor-move shrink-0 touch-none select-none"
        onPointerDown={handleDragStart}
      >
        <span className="text-xs font-medium text-neutral-300 pointer-events-none">Referensi Gambar</span>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div 
        className="flex-1 min-h-0 relative bg-neutral-950 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onPointerDown={handleImagePointerDown}
        onPointerMove={handleImagePointerMove}
        onPointerUp={handleImagePointerUp}
        onWheel={handleWheel}
      >
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt="Reference" 
            className="w-full h-full object-contain pointer-events-none select-none"
            style={{
              transform: `translate(${imgPan.x}px, ${imgPan.y}px) scale(${imgZoom})`,
              transformOrigin: "center"
            }}
          />
        ) : (
          <div className="text-center p-4">
            <ImageIcon size={32} className="mx-auto text-neutral-600 mb-2" />
            <p className="text-xs text-neutral-400 mb-3">Belum ada gambar</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded transition-colors"
            >
              Pilih Gambar
            </button>
          </div>
        )}
        
        {/* Floating actions when image loaded */}
        {imageUrl && (
          <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur-sm transition-colors"
              title="Ganti gambar"
            >
              <ImageIcon size={14} />
            </button>
            <button
              onClick={resetZoomPan}
              className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur-sm transition-colors"
              title="Reset Zoom & Pan"
            >
              <Maximize size={14} />
            </button>
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Resize handle */}
      <div 
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize touch-none flex items-end justify-end p-0.5 text-neutral-500"
        onPointerDown={handleResizeStart}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
          <polyline points="21 15 21 21 15 21"></polyline>
          <line x1="21" y1="21" x2="15" y2="15"></line>
        </svg>
      </div>
    </div>
  );
}
