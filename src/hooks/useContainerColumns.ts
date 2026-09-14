import { useEffect, useRef, useState } from "react";

// Menghitung berapa kolom item berukuran TETAP (itemSize) yang muat di lebar
// container saat ini, dengan jarak antar item sebesar gap.
export function useContainerColumns<T extends HTMLElement>(itemSize: number, gap: number) {
  const ref = useRef<T | null>(null);
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      const next = Math.max(1, Math.floor((width + gap) / (itemSize + gap)));
      setColumns(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [itemSize, gap]);

  return [ref, columns] as const;
}