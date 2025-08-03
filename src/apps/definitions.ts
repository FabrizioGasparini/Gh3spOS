import React from "react";
import { Settings } from "@/routes/settings";
import type { AppDefinition } from "@/types";

import { NotePad } from "@/apps/notepad";
import { Gh3Preview } from "@/apps/gh3preview";
import { FileExplorer } from "@/apps/file-explorer";
import { WidgetStore } from "@/apps/widget-store";
import { TestApp } from "@/apps/test-app";
import { Terminal } from "@/apps/terminal";
//import { SSHConnect } from "@/apps/ssh-connect"

export const apps: Map<string, AppDefinition> = new Map<string, AppDefinition>([
    [
        "settings",
        {
            name: "Impostazioni",
            icon: "dock-settings.png",
            component: Settings,
            isPinned: true,
        },
    ],
    [
        "notes",
        {
            name: "Note",
            icon: "default-icon.svg",
            component: () => React.createElement("h1", null, "Notes"),
            isPinned: false,
            defaultSize: { width: 30, height: 40 },
        },
    ],
    [
        "notepad",
        {
            name: "NotePad",
            icon: "gh3-pad.png",
            component: NotePad,
            defaultSize: { width: 25, height: 60 },
            isPinned: true,
        },
    ],
    [
        "gh3preview",
        {
            name: "Gh3Preview",
            icon: "dock-preview.png",
            component: Gh3Preview,
            defaultSize: { width: 30, height: 40 },
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
        },
    ],
    [
        "widget-store",
        {
            name: "Widget Store",
            icon: "dock-store.png",
            component: WidgetStore,
            isPinned: true,
        },
    ],
    [
        "terminal",
        {
            name: "Terminal",
            icon: "default-icon.svg",
            component: Terminal,
            isPinned: true,
            defaultSize: { width: 30, height: 40 },
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
