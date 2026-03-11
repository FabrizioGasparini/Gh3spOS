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
import { AppStore } from "@/apps/app-store";
import { VisualStudioCodeApp } from "@/apps/visual-studio-code";
import { GlobalFilePickerApp } from "@/apps/global-file-picker";
import { SSHConnect } from "@/apps/ssh-connect";
import { MailClient } from "@/apps/mail-client";

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
            ghost: true,
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
        "app-store",
        {
            name: "App Store",
            icon: "dock-store.png",
            component: AppStore,
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
    ],
    [
        "vs-code",
        {
            name: "Visual Studio Code",
            icon: "dock-vscode.png",
            component: VisualStudioCodeApp,
            isPinned: true,
            singleInstance: false,
            defaultSize: { width: 85, height: 90 },
        },
    ],
    [
        "global-file-picker",
        {
            name: "File Picker",
            icon: "default-icon.svg",
            component: GlobalFilePickerApp,
            isPinned: false,
            ghost: true,
            singleInstance: false,
            defaultSize: { width: 55, height: 70 },
        },
    ],
    [
        "gh3connect",
        {
            name: "SSH Connect",
            icon: "dock-ssh.png",
            component: SSHConnect,
            isPinned: true,
        },
    ],
    [
        "mail-client",
        {
            name: "Mail",
            icon: "dock-mail.svg",
            component: MailClient,
            isPinned: true,
            singleInstance: true,
            defaultSize: { width: 85, height: 90 },
        },
    ],
]);
