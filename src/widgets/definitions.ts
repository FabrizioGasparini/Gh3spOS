import type { WidgetDefinition } from "@/types";

// Widgets
import { ClockWidget } from "./clock";
import { WeatherWidget } from "./weather";
import { TodoWidget } from "./todo";
import { SystemInfoWidget } from "./system-info";
import { NotesWidget } from "./notes";
import { BatteryWidget } from "./battery";
import { NetworkWidget } from "./network";

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
        "system-info",
        {
            name: "Info Sistema",
            component: SystemInfoWidget,
            defaultSize: { width: 3, height: 2 },
            inStore: true,
            storeDescription: "Mostra RAM, CPU, OS e uptime del sistema",
        },
    ],
    [
        "notes",
        {
            name: "Note Veloci",
            component: NotesWidget,
            defaultSize: { width: 3, height: 3 },
            inStore: true,
            storeDescription: "Blocco note veloce con salvataggio automatico",
        },
    ],
    [
        "battery",
        {
            name: "Batteria",
            component: BatteryWidget,
            defaultSize: { width: 2, height: 1 },
            inStore: true,
            storeDescription: "Mostra livello e stato della batteria",
        },
    ],
    [
        "network",
        {
            name: "Rete",
            component: NetworkWidget,
            defaultSize: { width: 2, height: 1 },
            inStore: true,
            storeDescription: "Mostra stato della connessione e ping",
        },
    ],
]);
