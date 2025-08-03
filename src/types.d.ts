export interface AppDefinition {
    name: string;
    icon?: string;
    component: React.FC<Props>;
    isPinned?: boolean;
    defaultSize?: { width: number; height: number };
    optionalParams?: string[];
    ghost?: boolean;
}

export type WindowParamType = string | number | object | boolean | null;
export type WindowInstance = {
    id: string;
    appId: string;
    title: string;
    component: ReactNode;
    params?: Record<string, WindowParamType>;
    isMinimized?: boolean;
    isMaximized?: boolean;
    isFocused?: boolean;
    icon?: string;
    isPinned?: boolean;
    position: { x: number; y: number };
    size: { width: number; height: number };
    sizeLocked: boolean;
    ghost?: boolean;
};

export interface WidgetDefinition {
    name: string;
    component: React.FC<Props>;
    defaultSize?: { width: number; height: number };
    inStore?: boolean;
    storeDescription?: string;
}

export interface WidgetInstance {
    id: string;
    widgetId: string;
    component: ReactNode;
    position: { x: number; y: number };
    size: { width: number; height: number };
    fixed?: boolean;
}

export type FileItem = {
    name: string;
    type: "file" | "folder" | "disk";
    size?: number;
    modifiedAt?: string;
    diskLabel?: string;
    diskType?: string;
};

export type DriveItem = {
    name: string;
    label: string;
    type: string;
    size: number;
};
