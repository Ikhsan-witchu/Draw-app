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
  Wind,
  Slash,
  Circle,
  Blend,
} from "lucide-react";
import type { ToolItem } from "./types";

export const TOOLS: ToolItem[] = [
  { id: "brush",       icon: Pencil,      label: "Brush",            shortcut: "B" },
  { id: "eraser",      icon: Eraser,      label: "Eraser",           shortcut: "E" },
  { id: "line",        icon: Slash,       label: "Line",             shortcut: "L" },
  { id: "rectShape",   icon: Square,      label: "Rectangle",        shortcut: "U" },
  { id: "ellipseShape",icon: Circle,      label: "Ellipse" },
  { id: "gradient",    icon: Blend,       label: "Gradient",         shortcut: "G" },
  { id: "bucket",      icon: PaintBucket, label: "Fill",             shortcut: "G" },
  { id: "eyedropper",  icon: Pipette,     label: "Eyedropper",       shortcut: "I" },
  { id: "move",        icon: Move,        label: "Move / Pan",       shortcut: "V" },
  { id: "lasso",       icon: Lasso,       label: "Lasso select",     shortcut: "W" },
  { id: "rect",        icon: Square,      label: "Rectangle select", shortcut: "M" },
  { id: "text",        icon: Type,        label: "Text",             shortcut: "T" },
];

export const BRUSHES: ToolItem[] = [
  { id: "pen",      icon: PenTool,    label: "Pen" },
  { id: "round",    icon: Paintbrush, label: "Round brush" },
  { id: "flat",     icon: Paintbrush2, label: "Flat brush" },
  { id: "feather",  icon: Feather,    label: "Watercolor" },
  { id: "marker",   icon: Highlighter, label: "Marker" },
  { id: "pencil2",  icon: Pencil,     label: "Pencil" },
  { id: "airbrush", icon: Wind,       label: "Airbrush soft" },
  { id: "crayon",   icon: Pencil,     label: "Crayon" },
  { id: "charcoal", icon: Paintbrush, label: "Charcoal" },
  { id: "pixel",    icon: Square,     label: "Pixel" },
];