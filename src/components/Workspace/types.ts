import type { LucideIcon } from "lucide-react";

export type PanelId = "tools" | "brushes" | "brushSettings" | "hue" | "layers";
export type DockZone = "left" | "right" | "bottom";
export type DropPosition = "start" | "end";

export interface ToolItem {
  id: string;
  icon: LucideIcon;
  label: string;
}