// ─── Modul Abstraksi Persistensi: localStorage + IndexedDB ────────────────────

import type { LayerMeta } from "../types/drawing";

const STORAGE_KEY_ACTIVE = "draw_app_active_state_v1";
const STORAGE_KEY_RECENT = "draw_app_recent_project_v1";

const DB_NAME = "DrawAppDB";
const DB_VERSION = 1;
const STORE_LAYERS = "layerCanvases";

export interface PersistedTabMeta {
  id: string;
  title: string;
  width: number;
  height: number;
  layers: LayerMeta[];
  activeLayerId: string | null;
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
}

export interface PersistedAppState {
  activeTabId: string | null;
  tabs: PersistedTabMeta[];
  activeTool?: string;
  activeBrush?: string;
  brushSize?: number;
  brushOpacity?: number;
  stabilizerStrength?: number;
  shapeFilled?: boolean;
  color?: { hue: number; sat: number; val: number };
  leftWidth?: number;
  rightWidth?: number;
  bottomHeight?: number;
  leftPanels?: string[];
  rightPanels?: string[];
  bottomPanels?: string[];
}

export interface RecentProjectMeta {
  tab: PersistedTabMeta;
  thumbnailDataUrl: string;
  updatedAt: number;
  layerCount: number;
}

// ── IndexedDB Helper ─────────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB tidak didukung pada browser ini."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_LAYERS)) {
        db.createObjectStore(STORE_LAYERS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

// ── Canvas Layer Blob Operations (IndexedDB) ───────────────────────────────────

/** Simpan piksel layer canvas sebagai Blob PNG ke IndexedDB */
export async function saveLayerCanvasBlob(
  tabId: string,
  layerId: string,
  canvas: HTMLCanvasElement
): Promise<void> {
  try {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) return;

    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_LAYERS, "readwrite");
      const key = `${tabId}:${layerId}`;
      tx.objectStore(STORE_LAYERS).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Gagal menyimpan layer blob ke IndexedDB:", err);
  }
}

/** Ambil Blob PNG layer dari IndexedDB */
export async function loadLayerCanvasBlob(
  tabId: string,
  layerId: string
): Promise<Blob | null> {
  try {
    const db = await getDB();
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_LAYERS, "readonly");
      const key = `${tabId}:${layerId}`;
      const req = tx.objectStore(STORE_LAYERS).get(key);
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Gagal memuat layer blob dari IndexedDB:", err);
    return null;
  }
}

/** Salin Blob piksel ke HTMLCanvasElement dengan reset transform DPI agar 100% presisi */
export async function applyBlobToCanvas(
  canvas: HTMLCanvasElement,
  blob: Blob
): Promise<void> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.save();
        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
      bitmap.close();
      return;
    } catch {
      // Fallback ke Image jika createImageBitmap gagal
    }
  }

  await new Promise<void>((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.save();
        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    img.src = url;
  });
}

/** Hapus seluruh layer milik tab tertentu dari IndexedDB */
export async function deleteTabLayers(tabId: string): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_LAYERS, "readwrite");
      const store = tx.objectStore(STORE_LAYERS);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = req.result as string[];
        for (const key of keys) {
          if (typeof key === "string" && key.startsWith(`${tabId}:`)) {
            store.delete(key);
          }
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Gagal menghapus tab layers dari IndexedDB:", err);
  }
}

/** Hapus 1 layer tertentu dari IndexedDB */
export async function deleteLayerBlob(tabId: string, layerId: string): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_LAYERS, "readwrite");
      tx.objectStore(STORE_LAYERS).delete(`${tabId}:${layerId}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Gagal menghapus layer blob dari IndexedDB:", err);
  }
}

// ── Thumbnail Generator ───────────────────────────────────────────────────────

/** Buat thumbnail resolusi kecil (max 180px) untuk pratinjau Home screen */
export function createThumbnailDataUrl(
  compositeCanvas: HTMLCanvasElement,
  maxDimension = 180
): string {
  try {
    const thumb = document.createElement("canvas");
    const aspect = compositeCanvas.width / (compositeCanvas.height || 1);
    let tw = maxDimension;
    let th = Math.round(maxDimension / aspect);
    if (aspect < 1) {
      th = maxDimension;
      tw = Math.round(maxDimension * aspect);
    }
    thumb.width = Math.max(1, tw);
    thumb.height = Math.max(1, th);
    const ctx = thumb.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "medium";
      ctx.drawImage(compositeCanvas, 0, 0, thumb.width, thumb.height);
      return thumb.toDataURL("image/jpeg", 0.7);
    }
  } catch {
    // Abaikan jika error
  }
  return "";
}

// ── Active State (localStorage) ───────────────────────────────────────────────

export function saveActiveAppState(state: PersistedAppState): void {
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify(state));
  } catch (err) {
    console.warn("Gagal menyimpan state aktif ke localStorage:", err);
  }
}

export function loadActiveAppState(): PersistedAppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAppState;
    if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
      return parsed;
    }
  } catch {
    // Abaikan parse error
  }
  return null;
}

export function clearActiveAppState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_ACTIVE);
  } catch {
    // Abaikan
  }
}

// ── Recent Project Backup (Home Screen Recovery) ──────────────────────────────

export function saveRecentProject(recent: RecentProjectMeta): void {
  try {
    localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(recent));
  } catch (err) {
    console.warn("Gagal menyimpan recent project ke localStorage:", err);
  }
}

export function loadRecentProject(): RecentProjectMeta | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECENT);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecentProjectMeta;
    if (parsed && parsed.tab && parsed.tab.id) {
      return parsed;
    }
  } catch {
    // Abaikan parse error
  }
  return null;
}

export function clearRecentProject(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_RECENT);
  } catch {
    // Abaikan
  }
}

// ── Clear All ─────────────────────────────────────────────────────────────────

export async function clearAllPersistence(): Promise<void> {
  clearActiveAppState();
  clearRecentProject();
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_LAYERS, "readwrite");
      tx.objectStore(STORE_LAYERS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Gagal membersihkan IndexedDB:", err);
  }
}
