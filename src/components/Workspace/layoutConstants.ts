export const ICON_ITEM_SIZE = 22;
export const ICON_GRID_GAP = 2;
export const PANEL_PADDING = 4;

// Lebar yang dibutuhkan panel grid-ikon supaya pas menampilkan N item per baris,
// dengan ukuran item TETAP (tidak melar), plus padding panel di kiri-kanan.
export function widthForColumns(columns: number): number {
  return 2 * PANEL_PADDING + columns * ICON_ITEM_SIZE + (columns - 1) * ICON_GRID_GAP;
}