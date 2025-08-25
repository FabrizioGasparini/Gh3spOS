import { Settings } from "@/apps/settings/index";
import type { AppDefinition } from "@/types";

import { NotePad } from "@/apps/notepad";
import { Gh3Preview } from "@/apps/gh3preview";
import { FileExplorer } from "@/apps/file-explorer";
import { WidgetStore } from "@/apps/widget-store";
import { TestApp } from "@/apps/test-app";
import { Terminal } from "@/apps/terminal/index";
import { TaskManager } from "@/apps/task-manager";
import { BrowserApp } from "@/apps/browser";
//import { SSHConnect } from "@/apps/ssh-connect"

export const apps: Map<string, AppDefinition> = new Map<string, AppDefinition>([
    [
        "settings",
        {
            name: "Impostazioni",
            icon: "dock-settings.png",
            component: Settings,
            isPinned: true,
            singleInstance: true,
        },
    ],
    [
        "notepad",
        {
            name: "NotePad",
            icon: "dock-notepad.png",
            component: NotePad,
            defaultSize: { width: 25, height: 60 },
            isPinned: true,
        },
    ],
    [
        "gh3preview",
        {
            name: "Gh3Preview",
            icon: "preview.png",
            component: Gh3Preview,
            defaultSize: { width: 30, height: 40 },
            ghost: false,
            isPinned: false,
        },
    ],
    [
        "file-explorer",
        {
            name: "File Explorer",
            icon: "dock-files.png",
            component: FileExplorer,
            isPinned: true,
            singleInstance: true,
        },
    ],
    [
        "widget-store",
        {
            name: "Widget Store",
            icon: "dock-store.png",
            component: WidgetStore,
            isPinned: true,
            singleInstance: true,
        },
    ],
    [
        "terminal",
        {
            name: "Terminal",
            icon: "dock-terminal.png",
            component: Terminal,
            isPinned: true,
            defaultSize: { width: 30, height: 40 },
            singleInstance: true,
        },
    ],
    [
        "task-manager",
        {
            name: "Task Manager",
            icon: "task-manager.png",
            component: TaskManager,
            defaultSize: { width: 30, height: 40 },
            singleInstance: true,
        },
    ],
    [
        "browser",
        {
            name: "Browser",
            icon: "task-manager.png",
            isPinned: true,
            singleInstance: false,
            defaultSize: { width: 80, height: 80 }, // percentuali del tuo WM
            component: BrowserApp,
        },
    ],
    [
        "test-app",
        {
            name: "Test App",
            icon: "default-icon.svg",
            component: TestApp,
            isPinned: true,
            ghost: true,
            defaultSize: { width: 30, height: 40 },
        },
    ] /*,
	['gh3connect', {
		name: 'SSH Connect',
		icon: 'dock-ssh.png',
		component: SSHConnect,
		isPinned: true
	}]*/,
]);
