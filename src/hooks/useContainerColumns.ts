import { useEffect, useRef, useState } from "react";

export function useContainerColumns<T extends HTMLElement>(minItemWidth: number) {
  const ref = useRef<T | null>(null);
  const [columns, setColumns] = useState(3);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      setColumns(Math.max(1, Math.floor(width / minItemWidth)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [minItemWidth]);

  return [ref, columns] as const;
}