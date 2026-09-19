import {
  Pencil,
  Eraser,
  PaintBucket,
  Lasso,
  Square,
  Move,
  Pipette,
  Type,
  PenTool,
  Paintbrush,
  Paintbrush2,
  Feather,
  Highlighter,
} from "lucide-react";
import type { ToolItem } from "./types";

export const TOOLS: ToolItem[] = [
  { id: "brush", icon: Pencil, label: "Brush" },
  { id: "eraser", icon: Eraser, label: "Eraser" },
  { id: "bucket", icon: PaintBucket, label: "Fill" },
  { id: "lasso", icon: Lasso, label: "Lasso select" },
  { id: "rect", icon: Square, label: "Rectangle select" },
  { id: "move", icon: Move, label: "Move" },
  { id: "eyedropper", icon: Pipette, label: "Eyedropper" },
  { id: "text", icon: Type, label: "Text" },
];

export const BRUSHES: ToolItem[] = [
  { id: "pen", icon: PenTool, label: "Pen" },
  { id: "round", icon: Paintbrush, label: "Round brush" },
  { id: "flat", icon: Paintbrush2, label: "Flat brush" },
  { id: "feather", icon: Feather, label: "Airbrush" },
  { id: "marker", icon: Highlighter, label: "Marker" },
  { id: "pencil2", icon: Pencil, label: "Pencil" },
];