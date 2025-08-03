import React, { createContext, useContext, useState } from 'react';
import type { WidgetInstance, WidgetDefinition } from '@/types';
import { nanoid } from "nanoid"

type WidgetContextType = {
  widgets: WidgetInstance[];
  addWidget: (widget: WidgetDefinition, widgetId: string) => void;
  removeWidget: (id: string) => void;
  moveWidget: (id: string, position: { x: number, y: number }) => void;
  resizeWidget: (id: string, size: { width: number, height: number }) => void;
};

const WidgetContext = createContext<WidgetContextType | undefined>(undefined);

export const WidgetManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [widgets, setWidgets] = useState<WidgetInstance[]>([]);

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

  return (
    <WidgetContext.Provider value={{ widgets, addWidget, removeWidget, moveWidget, resizeWidget }}>
      {children}
    </WidgetContext.Provider>
  );
};

export const useWidgetManager = () => {
  const ctx = useContext(WidgetContext);
  if (!ctx) throw new Error('useWidgetManager must be used within WidgetManagerProvider');
  return ctx;
};
