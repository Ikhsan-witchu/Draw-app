import type { LucideIcon } from "lucide-react";

export type PanelId = "tools" | "pencils" | "hue";
export type SidebarSide = "left" | "right";
export type DropPosition = "start" | "end";

export interface ToolItem {
  id: string;
  icon: LucideIcon;
  label: string;
}