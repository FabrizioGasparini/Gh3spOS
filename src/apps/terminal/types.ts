import type { AppDefinition, WindowInstance, WidgetInstance } from "@/types";

export interface TerminalContext {
    apps: Map<string, AppDefinition>;
    windows: WindowInstance[];
    windowId: string;
    widgets: WidgetInstance[];
    removeWidget: (id: string) => void;
    openWindow: (app: AppDefinition, appId: string) => void;
    closeWindow: (id: string) => void;
    setWallpaper: (url: string) => void;
    setOutput: (v: string[] | ((prev: string[]) => string[])) => void;
    commands: string[];
    setCommands: (v: string[] | ((prev: string[]) => string[])) => void;
}
