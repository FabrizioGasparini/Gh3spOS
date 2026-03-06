import type { TerminalContext } from "./types";
import type { VfsNode } from "./types";

export type CommandHandler = (args: string[], context: TerminalContext) => string | Promise<string>;

const USERNAME = "gh3sp"

const COMMAND_HELP: Record<string, string> = {
    help: "help [cmd] - mostra help generale o di un comando",
    man: "man <cmd> - manuale comando",
    clear: "clear - pulisce lo schermo",
    exit: "exit - chiude la finestra terminale",
    pwd: "pwd - mostra directory corrente",
    ls: "ls [path] - lista contenuto directory",
    cd: "cd <path> - cambia directory",
    mkdir: "mkdir <name> - crea directory",
    touch: "touch <file> - crea file vuoto",
    cat: "cat <file> - mostra contenuto file",
    write: "write <file> <text> - scrive testo su file",
    rm: "rm <path> - elimina file o directory",
    ps: "ps - processi (finestre/widget)",
    run: "run <appId> [count] - avvia app",
    kill: "kill <windowId|appId|widgetId> - termina processo",
    apps: "apps - lista app disponibili",
    pkg: "pkg <list|search|install|remove> - package manager app",
    secure: "secure <status|google|open|url|restart> [target] - gestione browser Selenium remoto",
    history: "history [clear] - cronologia comandi",
    echo: "echo <text> - stampa testo",
    whoami: "whoami - utente corrente",
    hostname: "hostname - host corrente",
    uname: "uname - info sistema",
    date: "date - data corrente",
    time: "time - ora corrente",
    calc: "calc <expr> - calcolatrice (solo + - * / % parentesi)",
    wallpaper: "wallpaper <url> - cambia wallpaper",
}

const ROOT_FS: VfsNode = {
    type: "dir",
    children: {
        home: {
            type: "dir",
            children: {
                [USERNAME]: {
                    type: "dir",
                    children: {
                        "README.txt": { type: "file", content: "Welcome to Gh3spOS terminal. Type 'help' to start." },
                        "notes.txt": { type: "file", content: "This is your virtual filesystem." },
                    },
                },
            },
        },
        tmp: { type: "dir", children: {} },
        var: { type: "dir", children: {} },
        etc: { type: "dir", children: { "os-release": { type: "file", content: "NAME=Gh3spOS\nVERSION=1.0" } } },
    },
}

const ensureRootFs = (vfs: VfsNode): VfsNode => {
    if (vfs && vfs.type === "dir" && vfs.children) return vfs
    return ROOT_FS
}

const splitPath = (path: string) => path.split("/").filter(Boolean)

const normalizePath = (path: string, cwd: string) => {
    const base = path.startsWith("/") ? [] : splitPath(cwd)
    for (const part of splitPath(path)) {
        if (part === ".") continue
        if (part === "..") base.pop()
        else base.push(part)
    }
    return "/" + base.join("/")
}

const resolveNode = (root: VfsNode, absPath: string): VfsNode | null => {
    const parts = splitPath(absPath)
    let node: VfsNode = root
    for (const part of parts) {
        if (node.type !== "dir" || !node.children?.[part]) return null
        node = node.children[part]
    }
    return node
}

const resolveParent = (root: VfsNode, absPath: string): { parent: VfsNode; name: string } | null => {
    const parts = splitPath(absPath)
    const name = parts.pop()
    if (!name) return null
    const parentPath = "/" + parts.join("/")
    const parent = resolveNode(root, parentPath)
    if (!parent || parent.type !== "dir") return null
    return { parent, name }
}

const cloneVfs = (vfs: VfsNode): VfsNode => JSON.parse(JSON.stringify(vfs)) as VfsNode

const listDirNames = (node: VfsNode) => {
    if (node.type !== "dir" || !node.children) return []
    return Object.entries(node.children)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, child]) => (child.type === "dir" ? `${name}/` : name))
}

const safeCalc = (expression: string) => {
    const expr = expression.trim()
    if (!expr) return "Usage: calc <expression>"
    if (!/^[0-9+\-*/().%\s]+$/.test(expr)) return "Invalid expression"
    try {
        const result = Function(`"use strict"; return (${expr})`)() as number
        if (!Number.isFinite(result)) return "Math error"
        return String(result)
    } catch {
        return "Invalid expression"
    }
}

const PROTECTED_PACKAGE_IDS = ['settings', 'file-explorer', 'app-store']

const getPackageIds = (context: Pick<TerminalContext, 'packageIds'>) => context.packageIds

const installPackage = async (appId: string, context: TerminalContext) => {
    const packageIds = getPackageIds(context)
    if (!packageIds.includes(appId)) return `Package not found: ${appId}`
    if (context.isInstalled(appId)) {
        if (!context.isEnabled(appId)) context.setAppEnabled(appId, true)
        return `Package already installed: ${appId}`
    }

    context.installApp(appId)
    context.setAppEnabled(appId, true)
    return `Installed package: ${appId}`
}

const uninstallPackage = async (appId: string, context: TerminalContext) => {
    const packageIds = getPackageIds(context)
    if (!packageIds.includes(appId)) return `Package not found: ${appId}`
    if (PROTECTED_PACKAGE_IDS.includes(appId)) return `Protected package cannot be removed: ${appId}`
    if (!context.isInstalled(appId)) return `Package not installed: ${appId}`

    context.uninstallApp(appId)
    const appWindows = context.windows.filter((window) => window.appId === appId)
    for (const window of appWindows) {
        context.closeWindow(window.id)
    }

    if (appWindows.length > 0) {
        return `Removed package: ${appId} (closed ${appWindows.length} instance${appWindows.length > 1 ? 's' : ''})`
    }
    return `Removed package: ${appId}`
}

const listPackages = (context: TerminalContext) => {
    const lines = getPackageIds(context).sort((a, b) => context.isInstalled(a) ? 1 : context.isInstalled(b) ? -1 : a.localeCompare(b)).map((id) => {
        const state = context.isInstalled(id)
            ? (context.isEnabled(id) ? 'installed' : 'installed (disabled)')
            : 'available'
        return `${id.padEnd(18)} ${state}`
    })
    return ['Packages:', ...lines].join('\n')
}

const callSecureBrowserApi = async (path: string, init?: RequestInit) => {
    const response = await fetch(`http://localhost:3001${path}`, {
        ...init,
        headers: {
            'content-type': 'application/json',
            ...(init?.headers || {}),
        },
    })

    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok || payload?.ok === false) {
        const msg = typeof payload?.error === 'string' ? payload.error : `HTTP ${response.status}`
        throw new Error(msg)
    }
    return payload
}

export const commandHandlers: Record<string, CommandHandler> = {
    pwd: (_args, { cwd }) => cwd,

    ls: (args, { cwd, vfs }) => {
        const root = ensureRootFs(vfs)
        const target = normalizePath(args[0] || ".", cwd)
        const node = resolveNode(root, target)
        if (!node) return `ls: cannot access '${args[0] || "."}': No such file or directory`
        if (node.type === "file") return args[0] || target.split("/").pop() || "file"
        const items = listDirNames(node)
        return items.length ? items.join("  ") : ""
    },

    cd: (args, { cwd, setCwd, vfs }) => {
        const root = ensureRootFs(vfs)
        const next = normalizePath(args[0] || `/home/${USERNAME}`, cwd)
        const node = resolveNode(root, next)
        if (!node) return `cd: ${args[0] || ""}: No such file or directory`
        if (node.type !== "dir") return `cd: ${args[0] || ""}: Not a directory`
        setCwd(next)
        return ""
    },

    mkdir: (args, { cwd, vfs, setVfs }) => {
        if (!args[0]) return "Usage: mkdir <name>"
        const root = cloneVfs(ensureRootFs(vfs))
        const target = normalizePath(args[0], cwd)
        const resolved = resolveParent(root, target)
        if (!resolved) return "mkdir: invalid path"
        const { parent, name } = resolved
        parent.children ||= {}
        if (parent.children[name]) return `mkdir: cannot create directory '${name}': File exists`
        parent.children[name] = { type: "dir", children: {} }
        setVfs(root)
        return ""
    },

    touch: (args, { cwd, vfs, setVfs }) => {
        if (!args[0]) return "Usage: touch <file>"
        const root = cloneVfs(ensureRootFs(vfs))
        const target = normalizePath(args[0], cwd)
        const resolved = resolveParent(root, target)
        if (!resolved) return "touch: invalid path"
        const { parent, name } = resolved
        parent.children ||= {}
        if (!parent.children[name]) parent.children[name] = { type: "file", content: "" }
        setVfs(root)
        return ""
    },

    cat: (args, { cwd, vfs }) => {
        if (!args[0]) return "Usage: cat <file>"
        const root = ensureRootFs(vfs)
        const target = normalizePath(args[0], cwd)
        const node = resolveNode(root, target)
        if (!node) return `cat: ${args[0]}: No such file or directory`
        if (node.type !== "file") return `cat: ${args[0]}: Is a directory`
        return node.content || ""
    },

    write: (args, { cwd, vfs, setVfs }) => {
        if (!args[0]) return "Usage: write <file> <text>"
        const root = cloneVfs(ensureRootFs(vfs))
        const target = normalizePath(args[0], cwd)
        const resolved = resolveParent(root, target)
        if (!resolved) return "write: invalid path"
        const { parent, name } = resolved
        parent.children ||= {}
        parent.children[name] = { type: "file", content: args.slice(1).join(" ") }
        setVfs(root)
        return ""
    },

    rm: (args, { cwd, vfs, setVfs }) => {
        if (!args[0]) return "Usage: rm <path>"
        const root = cloneVfs(ensureRootFs(vfs))
        const target = normalizePath(args[0], cwd)
        if (target === "/") return "rm: cannot remove '/'"
        const resolved = resolveParent(root, target)
        if (!resolved) return "rm: invalid path"
        const { parent, name } = resolved
        if (!parent.children?.[name]) return `rm: cannot remove '${args[0]}': No such file or directory`
        delete parent.children[name]
        setVfs(root)
        return ""
    },

    run: (args, { apps, packageIds, openWindow, isInstalled, isEnabled }) => {
        if (!args[0]) return "Usage: run <appId> [count]"
        const appId = args[0]
        const targetApp = apps.get(appId)
        if (!targetApp) {
            if (packageIds.includes(appId)) {
                if (!isInstalled(appId)) return `Package not installed: ${appId}. Use 'pkg install ${appId}'`
                if (!isEnabled(appId)) return `Package disabled: ${appId}. Enable it from App Store`
            }
            return `App not found: ${appId}`
        }
        if (targetApp) {
            const count = parseInt(args[1]) || 1;
            for (let i = 0; i < count; i++) openWindow(targetApp, appId);
            return `Launched ${appId}`;
        }
        return `App not found: ${appId}`;
    },

    pkg: async (args, context) => {
        const action = (args[0] || 'list').toLowerCase()
        const target = (args[1] || '').trim()
        const packageIds = getPackageIds(context)

        if (action === 'list') return listPackages(context)
        if (action === 'search') {
            const term = target.toLowerCase()
            const results = packageIds.filter((id) => id.toLowerCase().includes(term))
            return results.length ? results.join('\n') : `No package match for: ${target}`
        }
        if (action === 'install') {
            if (!target) return 'Usage: pkg install <appId>'
            return installPackage(target, context)
        }
        if (action === 'remove' || action === 'uninstall') {
            if (!target) return 'Usage: pkg remove <appId>'
            return uninstallPackage(target, context)
        }

        return 'Usage: pkg <list|search|install|remove> [appId|term]'
    },

    secure: async (args, context) => {
        const action = (args[0] || 'status').toLowerCase()

        if (action === 'status') {
            try {
                const payload = await callSecureBrowserApi('/secure-browser/status', { method: 'GET' })
                const seleniumOnline = Boolean(payload.seleniumOnline)
                const novncOnline = Boolean(payload.novncOnline)
                const online = Boolean(payload.online)
                const checkedAt = String(payload.checkedAt || '')
                return [
                    'Secure Browser status',
                    `online:   ${online ? 'yes' : 'no'}`,
                    `selenium: ${seleniumOnline ? 'up' : 'down'}`,
                    `novnc:    ${novncOnline ? 'up' : 'down'}`,
                    checkedAt ? `checked:  ${checkedAt}` : '',
                ].filter(Boolean).join('\n')
            } catch (error) {
                return `Secure status error: ${String(error)}`
            }
        }

        if (action === 'google') {
            try {
                const payload = await callSecureBrowserApi('/secure-browser/open-default', {
                    method: 'POST',
                    body: JSON.stringify({ url: 'https://www.google.com' }),
                })
                const url = String(payload.url || 'https://www.google.com')
                if (!context.isInstalled('browser')) {
                    context.installApp('browser')
                }
                context.setAppEnabled('browser', true)
                const browserApp = context.apps.get('browser')
                if (browserApp) context.openWindow(browserApp, 'browser')
                return `Secure browser opened on: ${url}`
            } catch (error) {
                return `Secure open error: ${String(error)}`
            }
        }

        if (action === 'restart') {
            try {
                const payload = await callSecureBrowserApi('/secure-browser/restart', { method: 'POST' })
                const online = Boolean(payload.online)
                return `Secure browser service restarted (${online ? 'online' : 'offline'})`
            } catch (error) {
                return `Secure restart error: ${String(error)}`
            }
        }

        if (action === 'open' || action === 'url' || action === 'navigate') {
            const target = args.slice(1).join(' ').trim()
            if (!target) return 'Usage: secure open <url|query>'
            const isUrl = /^https?:\/\//i.test(target) || /^[^\s]+\.[^\s]{2,}/.test(target)
            const normalized = isUrl
                ? (target.includes('://') ? target : `https://${target}`)
                : `https://www.google.com/search?q=${encodeURIComponent(target)}`

            try {
                const payload = await callSecureBrowserApi('/secure-browser/navigate', {
                    method: 'POST',
                    body: JSON.stringify({ url: normalized }),
                })
                const url = String(payload.url || normalized)
                if (!context.isInstalled('browser')) {
                    context.installApp('browser')
                }
                context.setAppEnabled('browser', true)
                const browserApp = context.apps.get('browser')
                if (browserApp) context.openWindow(browserApp, 'browser')
                return `Secure browser navigated to: ${url}`
            } catch (error) {
                return `Secure navigate error: ${String(error)}`
            }
        }

        return 'Usage: secure <status|google|open|url|restart> [target]'
    },

    apps: (_args, { apps }) => Array.from(apps.entries()).map(([id, app]) => `${id.padEnd(14)} ${app.name}`).join("\n"),

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

    calc: (args) => safeCalc(args.join("")),

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

    wallpaper: (args, { setWallpaper }) => {
        if (!args[0]) return "Usage: wallpaper <url>"
        setWallpaper(args[0])
        return "Wallpaper updated"
    },

    man: (args) => {
        if (!args[0]) return "Usage: man <command>"
        return COMMAND_HELP[args[0]] || `No manual entry for ${args[0]}`
    },

    help: (args) => {
        if (args[0]) return COMMAND_HELP[args[0]] || `No help for ${args[0]}`
        const cmds = Object.keys(commandHandlers).sort();
        const maxLen = cmds.reduce((max, cmd) => Math.max(max, cmd.length), 0)
        const lines = cmds.map((cmd) => {
            const doc = COMMAND_HELP[cmd] || cmd
            const brief = doc.includes(" - ") ? doc.split(" - ").slice(1).join(" - ") : doc
            return `${cmd.padEnd(maxLen)}  ${brief}`
        })
        return [`Gh3spOS Shell`, ``, `Available commands:`, ...lines].join("\n")
    },
};

export const commandSuggestions: Record<string, (args: string[], ctx: TerminalContext) => string[]> = {
    run: (args, ctx) => {
        const current = args[0] || "";
        return getPackageIds(ctx).filter((appId) => appId.startsWith(current));
    },

    kill: (args, { windows }) => {
        const current = args[0] || "";
        return [...new Set(windows.map((w) => w.id).concat(windows.map((w) => w.appId)))].filter((id) => id.startsWith(current));
    },

    ls: (args, { cwd, vfs }) => {
        const root = ensureRootFs(vfs)
        const target = normalizePath(args[0] || ".", cwd)
        const node = resolveNode(root, target)
        if (!node || node.type !== "dir") return []
        const current = args[0] && !args[0].endsWith("/") ? splitPath(args[0]).pop() || "" : ""
        return listDirNames(node).filter((name) => name.startsWith(current))
    },

    cd: (args, ctx) => commandSuggestions.ls(args, ctx),

    cat: (args, { cwd, vfs }) => {
        const root = ensureRootFs(vfs)
        const target = normalizePath(args[0] || ".", cwd)
        const node = resolveNode(root, target)
        if (!node || node.type !== "dir") return []
        const current = args[0] && !args[0].endsWith("/") ? splitPath(args[0]).pop() || "" : ""
        return Object.entries(node.children || {})
            .filter(([, child]) => child.type === "file")
            .map(([name]) => name)
            .filter((name) => name.startsWith(current))
    },

    rm: (args, ctx) => commandSuggestions.ls(args, ctx),

    mkdir: () => ["new_folder"],

    touch: () => ["new_file.txt"],

    write: (args, { cwd, vfs }) => {
        if (args.length <= 1) return commandSuggestions.cat([args[0] || ""], { cwd, vfs } as TerminalContext)
        return []
    },

    calc: () => ["2+2", "10/5", "3*3", "(5+3)/2"],

    echo: () => ["Hello", "Testing terminal"],

    history: () => ["clear"],

    wallpaper: () => ["/wallpapers/default.jpg"],

    man: () => Object.keys(COMMAND_HELP),

    ps: () => [],
    help: () => [],
    apps: () => [],
    secure: (args) => {
        const action = args[0] || ''
        const value = args[1] || ''
        if (!action) return ['status', 'google', 'open', 'url', 'restart']
        if (args.length === 1) return ['status', 'google', 'open', 'url', 'restart'].filter((item) => item.startsWith(action))
        if (action === 'open' || action === 'url') {
            return ['google.com', 'github.com', 'youtube.com', 'news'].filter((item) => item.startsWith(value))
        }
        return []
    },
    pkg: (args, ctx) => {
        const action = args[0] || ''
        const value = args[1] || ''
        if (!action) return ['list', 'search', 'install', 'remove']
        if (args.length === 1) return ['list', 'search', 'install', 'remove'].filter((item) => item.startsWith(action))
        if (action === 'install' || action === 'remove' || action === 'uninstall' || action === 'search') {
            return getPackageIds(ctx).filter((id) => id.startsWith(value))
        }
        return []
    },
    exit: () => [],
    clear: () => [],
    pwd: () => [],
    date: () => [],
    time: () => [],
    whoami: () => [],
    hostname: () => [],
    uname: () => [],
};
