import React, { createContext, useContext } from 'react';
import type { WidgetInstance, WidgetDefinition, WidgetSettingValue } from '@/types';
import { nanoid } from "nanoid"
import { usePersistentStore } from './persistent-store';
import { widgets as widgetsList } from '@/widgets/definitions';

type WidgetContextType = {
  widgets: WidgetInstance[];
  addWidget: (widget: WidgetDefinition, widgetId: string) => string;
  removeWidget: (id: string) => void;
  moveWidget: (id: string, position: { x: number, y: number }) => void;
  resizeWidget: (id: string, size: { width: number, height: number }) => void;
  updateWidgetStyle: (id: string, style: { opacity?: number, blur?: number, border?: number }) => void;
  updateWidgetSettings: (id: string, settings: { contentScaleMode?: 'auto' | 'manual', contentScale?: number, padding?: number, widgetSpecific?: Record<string, WidgetSettingValue> }) => void;
  updateWidgetSpecificSetting: (id: string, key: string, value: WidgetSettingValue) => void;
  setWidgetFixed: (id: string, fixed: boolean) => void;
  focusWidget: (id: string) => void;
  getWidgetComponent: (id: string) => React.ComponentType<Record<string, unknown>> | null
};

const WidgetContext = createContext<WidgetContextType | undefined>(undefined);
const DOCK_RESERVED_PX = 112

export const WidgetManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [widgets, setWidgets] = usePersistentStore<WidgetInstance[]>("widget-manager:widgets",[]);

  const clampWidgetPosition = (position: { x: number, y: number }, size: { width: number, height: number }) => {
    const viewportWidth = typeof window !== 'undefined' ? Math.max(1, window.innerWidth) : 1920
    const viewportHeightRaw = typeof window !== 'undefined' ? Math.max(1, window.innerHeight) : 1080
    const desktopHeight = Math.max(1, viewportHeightRaw - DOCK_RESERVED_PX)
    const widgetWidthPercent = (size.width / viewportWidth) * 100
    const widgetHeightPercent = (size.height / desktopHeight) * 100
    const maxX = Math.max(0, 100 - widgetWidthPercent)
    const maxY = Math.max(0, 100 - widgetHeightPercent)

    return {
      x: Math.max(0, Math.min(maxX, position.x)),
      y: Math.max(0, Math.min(maxY, position.y)),
    }
  }

  const normalizeWidget = (widget: WidgetInstance, index: number): WidgetInstance => {
    const legacyWidth = Number(widget.size?.width ?? 240)
    const legacyHeight = Number(widget.size?.height ?? 180)
    const width = Number.isFinite(legacyWidth)
      ? Math.max(180, Math.min(700, legacyWidth <= 12 ? legacyWidth * 120 : legacyWidth))
      : 280
    const height = Number.isFinite(legacyHeight)
      ? Math.max(120, Math.min(520, legacyHeight <= 8 ? legacyHeight * 95 : legacyHeight))
      : 180
    const preferredPosition = {
      x: Number(widget.position?.x ?? 8 + (index * 3) % 48),
      y: Number(widget.position?.y ?? 12 + (index * 4) % 36),
    }
    const clampedPosition = clampWidgetPosition(preferredPosition, { width, height })
    const opacity = Math.max(0, Math.min(100, Number(widget.style?.opacity ?? 78)))
    const blur = Math.max(0, Math.min(40, Number(widget.style?.blur ?? 12)))
    const border = Math.max(0, Math.min(100, Number(widget.style?.border ?? 18)))
    const contentScaleMode = widget.settings?.contentScaleMode === 'manual' ? 'manual' : 'auto'
    const contentScale = Math.max(40, Math.min(240, Number(widget.settings?.contentScale ?? 100)))
    const padding = Math.max(0, Math.min(24, Number(widget.settings?.padding ?? 8)))
    const widgetSpecific = (widget.settings?.widgetSpecific && typeof widget.settings.widgetSpecific === 'object')
      ? widget.settings.widgetSpecific
      : {}

    return {
      ...widget,
      size: { width, height },
      position: clampedPosition,
      zIndex: widget.zIndex ?? index + 1,
      style: { opacity, blur, border },
      settings: { contentScaleMode, contentScale, padding, widgetSpecific },
      fixed: Boolean(widget.fixed),
    }
  }

  React.useEffect(() => {
    setWidgets((prev) => {
      const normalized = prev.map((widget, index) => normalizeWidget(widget, index))
      const changed = normalized.some((widget, index) => JSON.stringify(widget) !== JSON.stringify(prev[index]))
      return changed ? normalized : prev
    })
  }, [setWidgets])

  const addWidget = (w: WidgetDefinition, widgetId: string) => {
    const widthUnits = Math.max(2, Math.min(w.defaultSize?.width ?? 2, 6))
    const heightUnits = Math.max(1, Math.min(w.defaultSize?.height ?? 2, 5))
    const size = { width: widthUnits * 120, height: heightUnits * 95 }
    const id = nanoid()
    setWidgets(prev => [
      ...prev,
      {
        ...w,
        id,
        widgetId,
        position: {
          x: Math.max(2, Math.min(78, 8 + ((prev.length * 7) % 56))),
          y: Math.max(6, Math.min(74, 10 + ((prev.length * 5) % 40))),
        },
        size: { width: size.width, height: size.height},
        zIndex: (prev.reduce((max, current) => Math.max(max, current.zIndex ?? 1), 1) + 1),
        style: { opacity: 78, blur: 12, border: 18 },
        settings: { contentScaleMode: 'auto', contentScale: 100, padding: 8, widgetSpecific: {} },
        fixed: false,
      },
    ]);

    return id;
  };

  const removeWidget = (id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
  };

  const moveWidget = (id: string, position: { x: number, y: number }) => {
    setWidgets(prev => prev.map(w => {
      if (w.id !== id) return w
      const nextPosition = clampWidgetPosition(position, w.size)
      return { ...w, position: nextPosition }
    }));
  };

  const resizeWidget = (id: string, size: {width: number, height: number}) => {
    const nextSize = {
      width: Math.max(180, Math.min(780, size.width)),
      height: Math.max(120, Math.min(580, size.height)),
    }
    setWidgets(prev => prev.map(w => (w.id === id ? { ...w, size: nextSize } : w)));
  };

  const updateWidgetStyle = (id: string, style: { opacity?: number, blur?: number, border?: number }) => {
    setWidgets(prev => prev.map(w => {
      if (w.id !== id) return w
      return {
        ...w,
        style: {
          opacity: Math.max(0, Math.min(100, style.opacity ?? w.style?.opacity ?? 78)),
          blur: Math.max(0, Math.min(40, style.blur ?? w.style?.blur ?? 12)),
          border: Math.max(0, Math.min(100, style.border ?? w.style?.border ?? 18)),
        }
      }
    }));
  }

  const updateWidgetSettings = (id: string, settings: { contentScaleMode?: 'auto' | 'manual', contentScale?: number, padding?: number, widgetSpecific?: Record<string, WidgetSettingValue> }) => {
    setWidgets(prev => prev.map(w => {
      if (w.id !== id) return w
      return {
        ...w,
        settings: {
          contentScaleMode: settings.contentScaleMode ?? w.settings?.contentScaleMode ?? 'auto',
          contentScale: Math.max(40, Math.min(240, settings.contentScale ?? w.settings?.contentScale ?? 100)),
          padding: Math.max(0, Math.min(24, settings.padding ?? w.settings?.padding ?? 8)),
          widgetSpecific: settings.widgetSpecific ?? w.settings?.widgetSpecific ?? {},
        }
      }
    }))
  }

  const updateWidgetSpecificSetting = (id: string, key: string, value: WidgetSettingValue) => {
    setWidgets(prev => prev.map(w => {
      if (w.id !== id) return w
      return {
        ...w,
        settings: {
          contentScaleMode: w.settings?.contentScaleMode ?? 'auto',
          contentScale: w.settings?.contentScale ?? 100,
          padding: w.settings?.padding ?? 8,
          widgetSpecific: {
            ...(w.settings?.widgetSpecific ?? {}),
            [key]: value,
          },
        },
      }
    }))
  }

  const setWidgetFixed = (id: string, fixed: boolean) => {
    setWidgets(prev => prev.map(w => (w.id === id ? { ...w, fixed } : w)))
  }

  const focusWidget = (id: string) => {
    setWidgets(prev => {
      const highest = prev.reduce((max, current) => Math.max(max, current.zIndex ?? 1), 1)
      return prev.map((widget) => widget.id === id ? { ...widget, zIndex: highest + 1 } : widget)
    })
  }

  const getWidgetComponent = (id: string) => {
      const widget = widgets.find((w) => w.id === id) ?? null;
  
      if (!widget) return null;
      
      return widgetsList.get(widget.widgetId)?.component || null
  }

  return (
    <WidgetContext.Provider value={{ widgets, addWidget, removeWidget, moveWidget, resizeWidget, updateWidgetStyle, updateWidgetSettings, updateWidgetSpecificSetting, setWidgetFixed, focusWidget, getWidgetComponent }}>
      {children}
    </WidgetContext.Provider>
  );
};

export const useWidgetManager = () => {
  const ctx = useContext(WidgetContext);
  if (!ctx) throw new Error('useWidgetManager must be used within WidgetManagerProvider');
  return ctx;
};
