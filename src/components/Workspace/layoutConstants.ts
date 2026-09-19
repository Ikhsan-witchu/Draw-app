// Tools panel — compact icons (Krita-style)
export const ICON_ITEM_SIZE = 22;
export const ICON_GRID_GAP = 2;
export const PANEL_PADDING = 5;

// Brush Palette — larger items for visual brush previews
export const BRUSH_ITEM_SIZE = 40;
export const BRUSH_GRID_GAP = 4;
export const BRUSH_PANEL_PADDING = 8;

// Lebar yang dibutuhkan panel grid-ikon supaya pas menampilkan N item per baris,
// dengan ukuran item TETAP (tidak melar), plus padding panel di kiri-kanan.
export function widthForColumns(
  columns: number,
  itemSize = ICON_ITEM_SIZE,
  gap = ICON_GRID_GAP,
  padding = PANEL_PADDING,
): number {
  return 2 * padding + columns * itemSize + (columns - 1) * gap;
}