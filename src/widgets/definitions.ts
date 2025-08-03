import type { WidgetDefinition } from "@/types";
import { ClockWidget } from "./clock";
import { WeatherWidget } from "./weather";
import { TodoWidget } from "./todo";

export const widgets: Map<string, WidgetDefinition> = new Map<string, WidgetDefinition>([
    [
        "clock",
        {
            name: "Orologio",
            component: ClockWidget,
            defaultSize: { width: 1, height: 1 },
            inStore: true,
            storeDescription: "Orologio digitale elegante",
        },
    ],
    [
        "weather",
        {
            name: "Meteo",
            component: WeatherWidget,
            defaultSize: { width: 2, height: 2 },
            inStore: true,
            storeDescription: "Aggiornamenti Meteo (fake)",
        },
    ],
    [
        "todo",
        {
            name: "To-do List",
            component: TodoWidget,
            defaultSize: { width: 3, height: 4 },
            inStore: true,
            storeDescription: "Lista di cose da fare",
        },
    ],
]);
