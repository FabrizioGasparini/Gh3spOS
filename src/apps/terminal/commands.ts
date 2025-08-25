import type { TerminalContext } from "./types";

export type CommandHandler = (args: string[], context: TerminalContext) => string | Promise<string>;

export const commandHandlers: Record<string, CommandHandler> = {
    run: (args, { apps, openWindow }) => {
        if (apps.has(args[0])) {
            const count = parseInt(args[1]) || 1;
            for (let i = 0; i < count; i++) openWindow(apps.get(args[0])!, args[0]);
            return `Launched ${args[0]}`;
        }
        return `App not found: ${args[0]}`;
    },

    kill: (args, { windows, widgets, closeWindow, removeWidget }) => {
        const id = args[0];
        if (windows.some((w) => w.id === id)) {
            closeWindow(id);
            return `Terminated window ${id}`;
        } else if (windows.some((w) => w.appId === id)) {
            windows.filter((w) => w.appId === id).forEach((w) => closeWindow(w.id));
            return `Terminated all windows for ${id}`;
        } else if (widgets.some((w) => w.id === id)) {
            widgets.filter((w) => w.id === id).forEach((w) => removeWidget(w.id));
            return `Terminated widget ${id}`;
        }
        return `No matching window or app: ${id}`;
    },

    ps: (_args, { windows, widgets }) => {
        const lines = [...windows.map((w) => `win ${w.id} (${w.appId})`), ...widgets.map((w) => `wdg ${w.id} (${w.widgetId})`)];
        return lines.length ? lines.join("\n") : "No processes running";
    },

    clear: (_, { setOutput }) => {
        setOutput([]);
        return "";
    },

    exit: (_, { closeWindow, windowId }) => {
        closeWindow(windowId);
        return "";
    },

    echo: (args) => args.join(" "),

    date: () => new Date().toLocaleDateString(),

    time: () => new Date().toLocaleTimeString(),

    calc: (args) => {
        try {
            const result = eval(args.join(""));
            return String(result);
        } catch {
            return "Invalid expression";
        }
    },

    whoami: () => "user",

    hostname: () => "gh3os.local",

    uname: () => "Gh3OS 0.1.2 x64",

    history: (args, { commands, setCommands }) => {
        if (args[0] === "clear") {
            setCommands([]);
            return "Command history cleared";
        }
        return commands.map((c, i) => `  ${i}  ${c}`).join("\n");
    },

    help: () => {
        const cmds = Object.keys(commandHandlers).sort();
        return `Available commands:\n${cmds.join("\n")}`;
    },
};

export const commandSuggestions: Record<string, (args: string[], ctx: TerminalContext) => string[]> = {
    run: (args, { apps }) => {
        const current = args[0] || "";
        return Array.from(apps.keys()).filter((appId) => appId.startsWith(current));
    },

    kill: (args, { windows }) => {
        const current = args[0] || "";
        return [...new Set(windows.map((w) => w.id).concat(windows.map((w) => w.appId)))].filter((id) => id.startsWith(current));
    },

    calc: () => ["2+2", "10/5", "3*3", "(5+3)/2"],

    echo: () => ["Hello", "Testing terminal"],

    history: () => ["clear"],

    ps: () => [],
    help: () => [],
    exit: () => [],
    clear: () => [],
    date: () => [],
    time: () => [],
    whoami: () => [],
    hostname: () => [],
    uname: () => [],
};
