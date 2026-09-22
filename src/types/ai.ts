// ─── Tipe data untuk AI Drawing Assistant ────────────────────────────────────

export type RecommendedTool =
  | "brush"
  | "eraser"
  | "line"
  | "rectShape"
  | "ellipseShape"
  | "gradient"
  | "bucket"
  | "eyedropper";

export type RecommendedBrushType =
  | "pen"
  | "round"
  | "flat"
  | "feather"
  | "marker"
  | "pencil2"
  | "airbrush";

export interface ToolRecommendation {
  id: string; // unique ID for card tracking
  tool: RecommendedTool;
  brush_type?: RecommendedBrushType;
  brush_size_px: number;
  opacity_percent: number;
  color_hex?: string;
  steps: string[];
  explanation: string;
  status: "pending" | "applied" | "skipped";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  imagePreview?: string; // base64 / data URL for canvas screenshot preview in bubble
  recommendation?: ToolRecommendation;
  createdAt: number;
}

export interface AIChatSession {
  tabId: string;
  messages: ChatMessage[];
}
