import type { WidgetDefinition } from "@/types";

// Widgets
import { ClockWidget } from "./clock";
import { WeatherWidget } from "./weather";
import { TodoWidget } from "./todo";
import { QuickActionsWidget } from "./quick-actions";
import { CalendarPlannerWidget } from "./calendar-planner";
import { FocusTimerWidget } from "./focus-timer";

export const widgets: Map<string, WidgetDefinition> = new Map<string, WidgetDefinition>([
    [
        "clock",
        {
            name: "Orologio",
            component: ClockWidget,
            defaultSize: { width: 2, height: 1 },
            inStore: true,
            storeDescription: "Orologio digitale con data",
        },
    ],
    [
        "weather",
        {
            name: "Meteo",
            component: WeatherWidget,
            defaultSize: { width: 3, height: 2 },
            inStore: true,
            storeDescription: "Aggiornamenti meteo in tempo reale (API o mock)",
        },
    ],
    [
        "todo",
        {
            name: "To-do List",
            component: TodoWidget,
            defaultSize: { width: 3, height: 4 },
            inStore: true,
            storeDescription: "Lista di cose da fare con salvataggio persistente",
        },
    ],
    [
        "quick-actions",
        {
            name: "Quick Actions",
            component: QuickActionsWidget,
            defaultSize: { width: 3, height: 2 },
            inStore: true,
            storeDescription: "Apri app e controlla il sistema al volo",
        },
    ],
    [
        "calendar-planner",
        {
            name: "Planner",
            component: CalendarPlannerWidget,
            defaultSize: { width: 4, height: 4 },
            inStore: true,
            storeDescription: "Calendario mensile con task rapidi ed eventi imminenti",
        },
    ],
    [
        "focus-timer",
        {
            name: "Focus Timer",
            component: FocusTimerWidget,
            defaultSize: { width: 3, height: 2 },
            inStore: true,
            storeDescription: "Pomodoro timer con preset, progress e conteggio sessioni",
        },
    ],
]);
