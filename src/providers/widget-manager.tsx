import React, { createContext, useContext } from 'react';
import type { WidgetInstance, WidgetDefinition } from '@/types';
import { nanoid } from "nanoid"
import { usePersistentStore } from './persistent-store';
import { widgets as widgetsList } from '@/widgets/definitions';

type WidgetContextType = {
  widgets: WidgetInstance[];
  addWidget: (widget: WidgetDefinition, widgetId: string) => void;
  removeWidget: (id: string) => void;
  moveWidget: (id: string, position: { x: number, y: number }) => void;
  resizeWidget: (id: string, size: { width: number, height: number }) => void;
  getWidgetComponent: (id: string) => React.FC<any> | null
};

const WidgetContext = createContext<WidgetContextType | undefined>(undefined);

export const WidgetManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [widgets, setWidgets] = usePersistentStore<WidgetInstance[]>("widget-manager:widgets",[]);

  const addWidget = (w: WidgetDefinition, widgetId: string) => {
    const size = { width: w.defaultSize ? Math.min(w.defaultSize?.width ?? 2, 6) : 2, height: w.defaultSize ? Math.min(w.defaultSize?.height ?? 1, 5) : 1}
    const id = nanoid()
    setWidgets(prev => [
      ...prev,
      {
        ...w,
        id,
        widgetId,
        position: {x: Math.max(0, 50 - size.width / 2), y: Math.max(0, 50 - size.height / 2)},
        size: { width: size.width, height: size.height}
      },
    ]);
  };

  const removeWidget = (id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
  };

  const moveWidget = (id: string, position: { x: number, y: number }) => {
    position = {x: Math.max(0, position.x), y: Math.max(0, position.y)}
    setWidgets(prev => prev.map(w => (w.id === id ? { ...w, position } : w)));
  };

  const resizeWidget = (id: string, size: {width: number, height: number}) => {
    setWidgets(prev => prev.map(w => (w.id === id ? { ...w, size } : w)));
  };

  const getWidgetComponent = (id: string) => {
      const widget = widgets.filter((w) => w.id == id).length > 0 ? widgets.filter((w) => w.id == id)[0] : null;
  
      if (!widget) return null;
      
      return widgetsList.get(widget.widgetId)?.component || null
  }

  return (
    <WidgetContext.Provider value={{ widgets, addWidget, removeWidget, moveWidget, resizeWidget, getWidgetComponent }}>
      {children}
    </WidgetContext.Provider>
  );
};

export const useWidgetManager = () => {
  const ctx = useContext(WidgetContext);
  if (!ctx) throw new Error('useWidgetManager must be used within WidgetManagerProvider');
  return ctx;
};
