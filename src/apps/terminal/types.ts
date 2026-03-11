import type { AuthUser } from "@/providers/auth";
import type { AppPermissionKey } from "@/providers/apps";
import type { AppDefinition, WindowInstance, WidgetInstance } from "@/types";
import type { NotificationType } from "@/providers/notifications";

export type FsNodeType = "file" | "folder";

export interface FsNodeMeta {
    mode: number;
    owner: string;
    type: FsNodeType;
}

export interface TerminalContext {
    username: string;
    hostname: string;
    userHome: string;
    isRoot: boolean;
    setIsRoot: (v: boolean | ((prev: boolean) => boolean)) => void;
    rootPassword: string;
    setRootPassword: (v: string | ((prev: string) => string)) => void;
    apps: Map<string, AppDefinition>;
    packageIds: string[];
    installApp: (id: string) => void;
    uninstallApp: (id: string) => void;
    setAppEnabled: (id: string, value: boolean) => void;
    isInstalled: (id: string) => boolean;
    isEnabled: (id: string) => boolean;
    canUsePermission: (id: string, permission: AppPermissionKey) => boolean;
    notifyPermissionDenied: (message: string, type?: NotificationType) => void;
    startSshSession: (config: { host: string; port: number; username: string; password: string }) => Promise<string>;
    stopSshSession: () => void;
    isSshSessionActive: () => boolean;
    sendSshInput: (data: string) => void;
    windows: WindowInstance[];
    windowId: string;
    widgets: WidgetInstance[];
    removeWidget: (id: string) => void;
    openWindow: (app: AppDefinition, appId: string, params?: Record<string, string | number | object | boolean | null>) => WindowInstance | null;
    closeWindow: (id: string) => void;
    setWallpaper: (url: string) => void;
    currentUser: AuthUser | null;
    setOutput: (v: string[] | ((prev: string[]) => string[])) => void;
    commands: string[];
    setCommands: (v: string[] | ((prev: string[]) => string[])) => void;
    cwd: string;
    setCwd: (v: string | ((prev: string) => string)) => void;
    fsMeta: Record<string, FsNodeMeta>;
    setFsMeta: (v: Record<string, FsNodeMeta> | ((prev: Record<string, FsNodeMeta>) => Record<string, FsNodeMeta>)) => void;
}
