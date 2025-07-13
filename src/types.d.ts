export interface AppDefinition {
    name: string;
    icon?: string;
    component: React.FC<Props>;
    isPinned?: boolean;
    defaultSize?: { width: number; height: number };
    optionalParams?: string[];
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
};
