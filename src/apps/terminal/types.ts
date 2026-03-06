import type { AppDefinition, WindowInstance, WidgetInstance } from "@/types";

export type VfsNode = {
    type: "dir" | "file";
    children?: Record<string, VfsNode>;
    content?: string;
};

export interface TerminalContext {
    apps: Map<string, AppDefinition>;
    packageIds: string[];
    installApp: (id: string) => void;
    uninstallApp: (id: string) => void;
    setAppEnabled: (id: string, value: boolean) => void;
    isInstalled: (id: string) => boolean;
    isEnabled: (id: string) => boolean;
    windows: WindowInstance[];
    windowId: string;
    widgets: WidgetInstance[];
    removeWidget: (id: string) => void;
    openWindow: (app: AppDefinition, appId: string, params?: Record<string, string | number | object | boolean | null>) => WindowInstance;
    closeWindow: (id: string) => void;
    setWallpaper: (url: string) => void;
    setOutput: (v: string[] | ((prev: string[]) => string[])) => void;
    commands: string[];
    setCommands: (v: string[] | ((prev: string[]) => string[])) => void;
    cwd: string;
    setCwd: (v: string | ((prev: string) => string)) => void;
    vfs: VfsNode;
    setVfs: (v: VfsNode | ((prev: VfsNode) => VfsNode)) => void;
}
