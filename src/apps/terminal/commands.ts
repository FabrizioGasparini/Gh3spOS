import type { FsNodeMeta, FsNodeType, TerminalContext } from "./types";

export type CommandHandler = (args: string[], context: TerminalContext) => string | Promise<string>;

type CloudEntry = {
    name: string;
    type: "file" | "folder" | "disk";
    size?: number;
    modifiedAt?: string;
};

const CLOUD_BASE_URL = "https://www.gh3sp.com/cloud/api";
const ROOT_ONLY_PATHS = ["/etc", "/var", "/root", "/system"];
const ROOT_ONLY_COMMANDS = new Set(["kill", "wallpaper"]);
const PATH_COMMANDS = new Set(["ls", "cd", "cat", "rm", "mkdir", "touch", "write", "chmod", "chown"]);

const BLUE = "\x1b[94m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

const COMMAND_HELP: Record<string, string> = {
    help: "help [cmd] - mostra help generale o di un comando",
    man: "man <cmd> - manuale comando",
    clear: "clear - pulisce lo schermo",
    exit: "exit - esce da root o chiude la finestra terminale",
    pwd: "pwd - mostra directory corrente",
    ls: "ls [path] - lista contenuto directory cloud",
    cd: "cd <path> - cambia directory cloud",
    mkdir: "mkdir <name|path> - crea directory cloud",
    touch: "touch <file|path> - crea file cloud vuoto",
    cat: "cat <file> - mostra contenuto file cloud",
    write: "write <file> <text> - scrive testo su file cloud",
    rm: "rm <path> - elimina file o directory cloud",
    chmod: "chmod <mode> <path> - cambia permessi file/cartella (es: chmod 755 ./script.sh)",
    chown: "chown <owner> <path> - cambia owner file/cartella (solo root)",
    ps: "ps - processi (finestre/widget)",
    run: "run <appId> [count] - avvia app",
    kill: "kill <windowId|appId|widgetId> - termina processo (root)",
    apps: "apps - lista app disponibili",
    pkg: "pkg <list|search|install|remove> - package manager app (install/remove: root)",
    code: "code <open|new|cat|write|touch|rm|mkdir|ls> ... - operazioni file e apertura VS Code",
    secure: "secure <status|google|open|url|restart> [target] - gestione browser Selenium remoto",
    ssh: "ssh <user@host|host> [-p port] [-u user] [-pw password] | ssh disconnect - client SSH diretto in shell",
    history: "history [clear] - cronologia comandi",
    echo: "echo <text> - stampa testo",
    whoami: "whoami - utente corrente",
    id: "id - identità utente e gruppi",
    hostname: "hostname - host corrente",
    uname: "uname - info sistema",
    date: "date - data corrente",
    time: "time - ora corrente",
    calc: "calc <expr> - calcolatrice (solo + - * / % parentesi)",
    wallpaper: "wallpaper <url> - cambia wallpaper (root)",
    su: "su <password> - entra in modalità root",
    sudo: "sudo [-k|-v|-l|-s] <comando...> - esegue comando con privilegi root",
    deauth: "deauth - esce dalla modalità root",
    passwd: "passwd <newPassword> - cambia password root (solo root)",
};

const PROTECTED_PACKAGE_IDS = ["settings", "file-explorer", "app-store"];

const splitPath = (path: string) => path.split("/").filter(Boolean);

const sanitizeCwd = (cwd: string) => {
    const candidate = String(cwd || "").trim();
    if (!candidate.startsWith("/")) return "/";
    if (candidate === "/home" || candidate.startsWith("/home/")) return "/";
    return candidate;
};

const normalizePath = (path: string, cwd: string) => {
    const trimmed = String(path || "").trim();
    const input = trimmed || ".";
    const baseCwd = sanitizeCwd(cwd);
    const base = input.startsWith("/") ? [] : splitPath(baseCwd);
    for (const part of splitPath(input)) {
        if (part === ".") continue;
        if (part === "..") {
            base.pop();
            continue;
        }
        base.push(part);
    }
    return `/${base.join("/")}`.replace(/\/+$/g, "") || "/";
};

const parentPath = (absPath: string) => {
    if (absPath === "/") return "/";
    const parts = splitPath(absPath);
    parts.pop();
    return `/${parts.join("/")}` || "/";
};

const basename = (absPath: string) => splitPath(absPath).pop() || "";

const formatCloudPath = (absPath: string) => (absPath === "/" ? "/" : absPath.replace(/\/+$/g, ""));

const callCloudApi = async (endpoint: string, init?: RequestInit) => {
    const response = await fetch(`${CLOUD_BASE_URL}/${endpoint}`, init);
    const payload = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : `HTTP ${response.status}`;
        throw new Error(message);
    }
    return payload;
};

const listCloudDirectory = async (absPath: string): Promise<CloudEntry[]> => {
    const payload = await callCloudApi(`list2.php?path=${encodeURIComponent(formatCloudPath(absPath))}`, { method: "GET" });
    if (!Array.isArray(payload)) {
        throw new Error("No such file or directory");
    }
    return payload as CloudEntry[];
};

const readCloudFile = async (absPath: string) => {
    const payload = await callCloudApi(`read.php?path=${encodeURIComponent(formatCloudPath(absPath))}`, { method: "GET" }) as Record<string, unknown>;
    return payload;
};

const pathNeedsRoot = (absPath: string) => {
    if (absPath === "/") return false;
    return ROOT_ONLY_PATHS.some((prefix) => absPath === prefix || absPath.startsWith(`${prefix}/`));
};

const ensureRootForPath = (absPath: string, context: TerminalContext, action: string) => {
    if (context.isRoot) return "";
    if (!pathNeedsRoot(absPath)) return "";
    return `${action}: permission denied on '${absPath}' (root required)`;
};

const ensureRootForAction = (command: string, context: TerminalContext) => {
    if (context.isRoot) return "";
    if (!ROOT_ONLY_COMMANDS.has(command)) return "";
    return `${command}: permission denied (root required)`;
};

const safeCalc = (expression: string) => {
    const expr = expression.trim();
    if (!expr) return "Usage: calc <expression>";
    if (!/^[0-9+\-*/().%\s]+$/.test(expr)) return "Invalid expression";
    try {
        const result = Function(`\"use strict\"; return (${expr})`)() as number;
        if (!Number.isFinite(result)) return "Math error";
        return String(result);
    } catch {
        return "Invalid expression";
    }
};

const parseMode = (value: string) => {
    const trimmed = String(value || "").trim();
    if (!/^[0-7]{3,4}$/.test(trimmed)) return null;
    const normalized = trimmed.length === 4 ? trimmed.slice(1) : trimmed;
    return parseInt(normalized, 8);
};

const formatMode = (mode: number, type: FsNodeType) => {
    const bits = [0o400, 0o200, 0o100, 0o040, 0o020, 0o010, 0o004, 0o002, 0o001];
    const chars = ["r", "w", "x", "r", "w", "x", "r", "w", "x"];
    const rwx = bits.map((bit, index) => (mode & bit ? chars[index] : "-")).join("");
    return `${type === "folder" ? "d" : "-"}${rwx}`;
};

const isExecutableMode = (mode: number) => (mode & 0o111) !== 0;

const inferFileMode = (name: string) => (/\.(sh|run|bin|exe|cmd|bat)$/i.test(name) ? 0o755 : 0o644);

const normalizeMetaPath = (path: string) => (path === "/" ? "/" : path.replace(/\/+$/g, ""));

const getFsMetaStore = (context: Pick<TerminalContext, "fsMeta">): Record<string, FsNodeMeta> => {
    if (!context.fsMeta || typeof context.fsMeta !== "object" || Array.isArray(context.fsMeta)) return {};
    return context.fsMeta;
};

const defaultNodeMeta = (path: string, type: FsNodeType, context: Pick<TerminalContext, "username">): FsNodeMeta => {
    if (path === "/") return { owner: "root", mode: 0o755, type: "folder" };
    if (pathNeedsRoot(path)) return { owner: "root", mode: type === "folder" ? 0o755 : 0o644, type };
    return {
        owner: context.username || "gh3sp",
        mode: type === "folder" ? 0o755 : inferFileMode(basename(path)),
        type,
    };
};

const ensureNodeMeta = (path: string, type: FsNodeType, context: Pick<TerminalContext, "fsMeta" | "setFsMeta" | "username">) => {
    const key = normalizeMetaPath(path);
    const existing = getFsMetaStore(context)[key];
    if (existing) return existing;
    const nextMeta = defaultNodeMeta(key, type, context);
    context.setFsMeta((prev) => ({ ...prev, [key]: nextMeta }));
    return nextMeta;
};

const sanitizeNodeMeta = (path: string, fallbackType: FsNodeType, context: Pick<TerminalContext, "username">, raw?: Partial<FsNodeMeta>): FsNodeMeta => {
    const defaults = defaultNodeMeta(path, fallbackType, context);
    const owner = typeof raw?.owner === "string" && raw.owner.trim() ? raw.owner : defaults.owner;
    const type = raw?.type === "folder" || raw?.type === "file" ? raw.type : defaults.type;

    let mode = defaults.mode;
    if (typeof raw?.mode === "number" && Number.isFinite(raw.mode)) {
        mode = raw.mode;
    } else if (typeof raw?.mode === "string") {
        const parsed = parseInt(raw.mode, 8);
        if (Number.isFinite(parsed)) mode = parsed;
    }

    return { owner, mode, type };
};

const ensureMetadataFromListing = (directory: string, entries: CloudEntry[], context: Pick<TerminalContext, "fsMeta" | "setFsMeta" | "username">) => {
    const fsMeta = getFsMetaStore(context);
    const updates: Record<string, FsNodeMeta> = {};
    for (const entry of entries) {
        const abs = normalizeMetaPath(`${directory === "/" ? "" : directory}/${entry.name}`);
        if (!fsMeta[abs]) {
            updates[abs] = defaultNodeMeta(abs, entry.type === "folder" ? "folder" : "file", context);
        }
    }
    if (Object.keys(updates).length) {
        context.setFsMeta((prev) => ({ ...prev, ...updates }));
    }
};

const removeMetaTree = (target: string, context: Pick<TerminalContext, "setFsMeta">) => {
    const base = normalizeMetaPath(target);
    context.setFsMeta((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
            if (key === base || key.startsWith(`${base}/`)) {
                delete next[key];
            }
        }
        return next;
    });
};

const hasPermission = (meta: FsNodeMeta, user: string, action: "r" | "w" | "x") => {
    const shift = meta.owner === user ? 6 : 0;
    const mask = action === "r" ? 4 : action === "w" ? 2 : 1;
    return ((meta.mode >> shift) & mask) === mask;
};

const ensurePermission = (
    context: TerminalContext,
    path: string,
    action: "r" | "w" | "x",
    fallbackType: FsNodeType = "file",
    createIfMissing = true,
) => {
    if (context.isRoot) return "";
    const normalized = normalizeMetaPath(path);
    const existing = getFsMetaStore(context)[normalized];
    if (!existing && !createIfMissing) return "";
    const meta = sanitizeNodeMeta(normalized, fallbackType, context, existing || ensureNodeMeta(normalized, fallbackType, context));
    if (hasPermission(meta, context.username, action)) return "";
    return `permission denied: ${normalized}`;
};

const parentWritableCheck = (path: string, context: TerminalContext) => {
    if (context.isRoot) return "";
    const parent = parentPath(path);
    const readExec = ensurePermission(context, parent, "x", "folder");
    if (readExec) return readExec;
    return ensurePermission(context, parent, "w", "folder");
};

const colorizeName = (name: string, type: FsNodeType, mode: number) => {
    if (type === "folder") return `${BLUE}${name}/${RESET}`;
    if (isExecutableMode(mode)) return `${GREEN}${name}${RESET}`;
    return name;
};

const shellSplit = (line: string) => line.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];

const buildPathSuggestions = async (rawToken: string, cwd: string, onlyDirectories: boolean) => {
    const token = rawToken || "";
    const hasSlash = token.includes("/");
    const endsWithSlash = token.endsWith("/");

    const basePart = hasSlash ? token.slice(0, token.lastIndexOf("/") + 1) : "";
    const partial = endsWithSlash ? "" : hasSlash ? token.slice(token.lastIndexOf("/") + 1) : token;
    const basePath = endsWithSlash ? token : basePart || ".";
    const directory = normalizePath(basePath, cwd);

    try {
        const entries = await listCloudDirectory(directory);
        const matches = entries
            .filter((entry) => (onlyDirectories ? entry.type === "folder" : true))
            .filter((entry) => entry.name.startsWith(partial))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((entry) => {
                const prefix = hasSlash ? basePart : "";
                return `${prefix}${entry.name}${entry.type === "folder" ? "/" : ""}`;
            });
        return matches;
    } catch {
        return [];
    }
};

const resolveCloudNode = async (absPath: string): Promise<{ type: FsNodeType; name: string } | null> => {
    if (absPath === "/") return { type: "folder", name: "/" };

    try {
        const payload = await readCloudFile(absPath);
        if (payload && typeof payload === "object") {
            return { type: "file", name: basename(absPath) || "/" };
        }
    } catch {
        // Not a file, continue probing as directory/entry
    }

    try {
        await listCloudDirectory(absPath);
        return { type: "folder", name: basename(absPath) || "/" };
    } catch {
        try {
            const parentEntries = await listCloudDirectory(parentPath(absPath));
            const name = basename(absPath);
            const entry = parentEntries.find((item) => item.name === name);
            if (!entry) return null;
            return { type: entry.type === "folder" ? "folder" : "file", name };
        } catch {
            return null;
        }
    }
};

const formatLongNode = (absPath: string, node: { type: FsNodeType; name: string }, context: TerminalContext) => {
    const stored = getFsMetaStore(context)[normalizeMetaPath(absPath)] || ensureNodeMeta(absPath, node.type, context);
    const meta = sanitizeNodeMeta(absPath, node.type, context, stored);
    const colored = colorizeName(node.name === "/" ? "/" : node.name, node.type, meta.mode);
    return `${formatMode(meta.mode, node.type)} ${meta.owner.padEnd(10)} ${colored}`;
};

const getPackageIds = (context: Pick<TerminalContext, "packageIds">) => context.packageIds;

const installPackage = async (appId: string, context: TerminalContext) => {
    const packageIds = getPackageIds(context);
    if (!packageIds.includes(appId)) return `Package not found: ${appId}`;
    if (!context.isRoot) return "pkg install: permission denied (root required)";
    if (context.isInstalled(appId)) {
        if (!context.isEnabled(appId)) context.setAppEnabled(appId, true);
        return `Package already installed: ${appId}`;
    }

    context.installApp(appId);
    context.setAppEnabled(appId, true);
    return `Installed package: ${appId}`;
};

const uninstallPackage = async (appId: string, context: TerminalContext) => {
    const packageIds = getPackageIds(context);
    if (!packageIds.includes(appId)) return `Package not found: ${appId}`;
    if (PROTECTED_PACKAGE_IDS.includes(appId)) return `Protected package cannot be removed: ${appId}`;
    if (!context.isRoot) return "pkg remove: permission denied (root required)";
    if (!context.isInstalled(appId)) return `Package not installed: ${appId}`;

    context.uninstallApp(appId);
    const appWindows = context.windows.filter((window) => window.appId === appId);
    for (const window of appWindows) {
        context.closeWindow(window.id);
    }

    if (appWindows.length > 0) {
        return `Removed package: ${appId} (closed ${appWindows.length} instance${appWindows.length > 1 ? "s" : ""})`;
    }
    return `Removed package: ${appId}`;
};

const listPackages = (context: TerminalContext) => {
    const lines = getPackageIds(context)
        .sort((a, b) => (context.isInstalled(a) ? 1 : context.isInstalled(b) ? -1 : a.localeCompare(b)))
        .map((id) => {
            const state = context.isInstalled(id)
                ? context.isEnabled(id)
                    ? "installed"
                    : "installed (disabled)"
                : "available";
            return `${id.padEnd(18)} ${state}`;
        });
    return ["Packages:", ...lines].join("\n");
};

const callSecureBrowserApi = async (path: string, init?: RequestInit) => {
    const response = await fetch(`http://localhost:3001${path}`, {
        ...init,
        headers: {
            "content-type": "application/json",
            ...(init?.headers || {}),
        },
    });

    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok || payload?.ok === false) {
        const msg = typeof payload?.error === "string" ? payload.error : `HTTP ${response.status}`;
        throw new Error(msg);
    }
    return payload;
};

const executeAsRoot = async (cmd: string, args: string[], context: TerminalContext) => {
    const target = commandHandlers[cmd];
    if (!target) return `command not found: ${cmd}`;
    if (cmd === "sudo" || cmd === "su") return `${cmd}: nested elevation is not supported`;
    const elevatedContext: TerminalContext = {
        ...context,
        isRoot: true,
    };
    return target(args, elevatedContext);
};

const ensureTerminalPermission = (
    context: TerminalContext,
    permission: "filesystem" | "network" | "ssh",
    action: string,
) => {
    if (context.canUsePermission("terminal", permission)) return "";
    const message = `${action}: permission denied by policy (${permission})`;
    context.notifyPermissionDenied(`Terminal: ${message}`, "warning");
    return message;
};

type ParsedSshArgs =
    | { error: string }
    | {
        host: string;
        username: string;
        password: string;
        port: number;
    };

const parseSshCommandArgs = (args: string[]): ParsedSshArgs => {
    let host = "";
    let username = "";
    let password = "";
    let port = 22;

    for (let index = 0; index < args.length; index += 1) {
        const token = String(args[index] || "").trim();
        if (!token) continue;
        if (token === "-p" || token === "--port") {
            const raw = args[index + 1];
            if (!raw) return { error: "ssh: missing value for -p/--port" };
            const parsed = Number.parseInt(raw, 10);
            if (!Number.isFinite(parsed) || parsed <= 0) return { error: "ssh: invalid port" };
            port = parsed;
            index += 1;
            continue;
        }
        if (token === "-u" || token === "--user") {
            const raw = args[index + 1];
            if (!raw) return { error: "ssh: missing value for -u/--user" };
            username = String(raw).trim();
            index += 1;
            continue;
        }
        if (token === "-pw" || token === "--password") {
            const raw = args[index + 1];
            if (typeof raw !== "string") return { error: "ssh: missing value for -pw/--password" };
            password = raw;
            index += 1;
            continue;
        }
        if (!host) {
            host = token;
        }
    }

    if (!host) {
        return { error: "Usage: ssh <user@host|host> [-p port] [-u user] [-pw password]" };
    }

    if (host.includes("@")) {
        const [fromUser, fromHost] = host.split("@", 2);
        if (!username) username = fromUser;
        host = fromHost;
    }

    host = host.trim();
    username = username.trim();
    if (!host) return { error: "ssh: invalid host" };
    if (!username) return { error: "ssh: username required (use user@host or -u <user>)" };

    return {
        host,
        username,
        password,
        port,
    };
};

export const commandHandlers: Record<string, CommandHandler> = {
    pwd: (_args, { cwd }) => cwd,

    ls: async (args, context) => {
        const policyCheck = ensureTerminalPermission(context, "filesystem", "ls");
        if (policyCheck) return policyCheck;
        const longFormat = args.includes("-l");
        const explicitTarget = args.filter((arg) => !arg.startsWith("-"))[0];
        try {
            const targetArg = explicitTarget || ".";
            const { cwd } = context;
            const target = normalizePath(targetArg, cwd);

            const rootCheck = ensureRootForPath(target, context, "ls");
            if (rootCheck) return rootCheck;

            if (longFormat && explicitTarget) {
                const node = await resolveCloudNode(target);
                if (!node) return `ls: cannot access '${targetArg}': No such file or directory`;

                return formatLongNode(target, node, context);
            }

            const readCheck = ensurePermission(context, target, "r", "folder", false);
            if (readCheck) return `ls: ${targetArg}: ${readCheck}`;
            const execCheck = ensurePermission(context, target, "x", "folder", false);
            if (execCheck) return `ls: ${targetArg}: ${execCheck}`;

            const entries = await listCloudDirectory(target);
            ensureNodeMeta(target, "folder", context);
            ensureMetadataFromListing(target, entries, context);
            const items = entries
                .slice()
                .sort((a, b) => {
                    if (a.type === b.type) return a.name.localeCompare(b.name);
                    return a.type === "folder" ? -1 : 1;
                })
                .map((entry) => {
                    const abs = normalizeMetaPath(`${target === "/" ? "" : target}/${entry.name}`);
                    const stored = getFsMetaStore(context)[abs] || defaultNodeMeta(abs, entry.type === "folder" ? "folder" : "file", context);
                    const meta = sanitizeNodeMeta(abs, entry.type === "folder" ? "folder" : "file", context, stored);
                    const type = entry.type === "folder" ? "folder" : "file";
                    const colored = colorizeName(entry.name, type, meta.mode);
                    if (!longFormat) return colored;
                    return `${formatMode(meta.mode, type)} ${meta.owner.padEnd(10)} ${colored}`;
                });
            return items.join("\n");
        } catch (outerError) {
            try {
                const targetArg = args.filter((arg) => !arg.startsWith("-"))[0] || ".";
                const target = normalizePath(targetArg, context.cwd);
                const parentEntries = await listCloudDirectory(parentPath(target));
                const name = basename(target);
                const entry = parentEntries.find((item) => item.name === name);
                if (entry) {
                    const type = entry.type === "folder" ? "folder" : "file";
                    const meta = ensureNodeMeta(target, type, context);
                    const colored = colorizeName(entry.name, type, meta.mode);
                    if (!longFormat) return colored;
                    return `${formatMode(meta.mode, type)} ${meta.owner.padEnd(10)} ${colored}`;
                }
                return `ls: cannot access '${targetArg}': No such file or directory`;
            } catch {
                if (outerError instanceof Error && /Cannot read properties of undefined \(reading '\/'\)/.test(outerError.message)) {
                    return "ls: metadata cache recovered, retry command";
                }
                const targetArg = args.filter((arg) => !arg.startsWith("-"))[0] || ".";
                return `ls: cannot access '${targetArg}': No such file or directory`;
            }
        }
    },

    cd: async (args, context) => {
        const policyCheck = ensureTerminalPermission(context, "filesystem", "cd");
        if (policyCheck) return policyCheck;
        const { cwd, setCwd } = context;
        const next = normalizePath(args[0] || "/", cwd);
        const rootCheck = ensureRootForPath(next, context, "cd");
        if (rootCheck) return rootCheck;

        const node = await resolveCloudNode(next);
        if (!node) return `cd: ${args[0] || ""}: No such file or directory`;
        if (node.type !== "folder") return `cd: ${args[0] || ""}: Not a directory`;

        const execCheck = ensurePermission(context, next, "x", "folder", false);
        if (execCheck) return `cd: ${args[0] || ""}: ${execCheck}`;
        const readCheck = ensurePermission(context, next, "r", "folder", false);
        if (readCheck) return `cd: ${args[0] || ""}: ${readCheck}`;
        try {
            await listCloudDirectory(next);
            ensureNodeMeta(next, "folder", context);
            setCwd(next);
            return "";
        } catch {
            return `cd: ${args[0] || ""}: Not a directory`;
        }
    },

    mkdir: async (args, context) => {
        const policyCheck = ensureTerminalPermission(context, "filesystem", "mkdir");
        if (policyCheck) return policyCheck;
        if (!args[0]) return "Usage: mkdir <name|path>";
        const target = normalizePath(args[0], context.cwd);
        const rootCheck = ensureRootForPath(target, context, "mkdir");
        if (rootCheck) return rootCheck;
        const parentCheck = parentWritableCheck(target, context);
        if (parentCheck) return `mkdir: ${args[0]}: ${parentCheck}`;
        try {
            await callCloudApi("createFolder.php", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ path: target }),
            });
            ensureNodeMeta(target, "folder", context);
            return "";
        } catch (error) {
            return `mkdir: cannot create directory '${args[0]}': ${String(error)}`;
        }
    },

    touch: async (args, context) => {
        const policyCheck = ensureTerminalPermission(context, "filesystem", "touch");
        if (policyCheck) return policyCheck;
        if (!args[0]) return "Usage: touch <file|path>";
        const target = normalizePath(args[0], context.cwd);
        const rootCheck = ensureRootForPath(target, context, "touch");
        if (rootCheck) return rootCheck;
        const parentCheck = parentWritableCheck(target, context);
        if (parentCheck) return `touch: ${args[0]}: ${parentCheck}`;
        try {
            await callCloudApi("createFile.php", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ path: target }),
            });
            ensureNodeMeta(target, "file", context);
            return "";
        } catch (error) {
            return `touch: cannot touch '${args[0]}': ${String(error)}`;
        }
    },

    cat: async (args, context) => {
        const policyCheck = ensureTerminalPermission(context, "filesystem", "cat");
        if (policyCheck) return policyCheck;
        const { cwd } = context;
        if (!args[0]) return "Usage: cat <file>";
        const target = normalizePath(args[0], cwd);
        const rootCheck = ensureRootForPath(target, context, "cat");
        if (rootCheck) return rootCheck;
        const readCheck = ensurePermission(context, target, "r", "file");
        if (readCheck) return `cat: ${args[0]}: ${readCheck}`;
        try {
            const payload = await readCloudFile(target);
            ensureNodeMeta(target, "file", context);
            const content = payload?.content;
            if (typeof content === "string") return content;
            const mimeType = typeof payload?.mime === "string" ? payload.mime : "binary/octet-stream";
            return `cat: ${args[0]}: binary file (${mimeType})`;
        } catch (error) {
            return `cat: ${args[0]}: ${String(error)}`;
        }
    },

    write: async (args, context) => {
        const policyCheck = ensureTerminalPermission(context, "filesystem", "write");
        if (policyCheck) return policyCheck;
        if (!args[0]) return "Usage: write <file> <text>";
        const target = normalizePath(args[0], context.cwd);
        const rootCheck = ensureRootForPath(target, context, "write");
        if (rootCheck) return rootCheck;
        const parentCheck = parentWritableCheck(target, context);
        if (parentCheck) return `write: ${args[0]}: ${parentCheck}`;
        const existingMeta = getFsMetaStore(context)[normalizeMetaPath(target)];
        if (existingMeta) {
            const writeCheck = ensurePermission(context, target, "w", "file");
            if (writeCheck) return `write: ${args[0]}: ${writeCheck}`;
        }
        try {
            await callCloudApi("saveFile.php", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ path: target, content: args.slice(1).join(" ") }),
            });
            ensureNodeMeta(target, "file", context);
            return "";
        } catch (error) {
            return `write: ${args[0]}: ${String(error)}`;
        }
    },

    rm: async (args, context) => {
        const policyCheck = ensureTerminalPermission(context, "filesystem", "rm");
        if (policyCheck) return policyCheck;
        if (!args[0]) return "Usage: rm <path>";
        const target = normalizePath(args[0], context.cwd);
        if (target === "/") return "rm: cannot remove '/'";
        const rootCheck = ensureRootForPath(target, context, "rm");
        if (rootCheck) return rootCheck;
        const parentCheck = parentWritableCheck(target, context);
        if (parentCheck) return `rm: cannot remove '${args[0]}': ${parentCheck}`;
        try {
            await callCloudApi("deleteFile.php", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ path: target }),
            });
            removeMetaTree(target, context);
            return "";
        } catch (error) {
            return `rm: cannot remove '${args[0]}': ${String(error)}`;
        }
    },

    chmod: async (args, context) => {
        const policyCheck = ensureTerminalPermission(context, "filesystem", "chmod");
        if (policyCheck) return policyCheck;
        if (args.length < 2) return "Usage: chmod <mode> <path>";
        const mode = parseMode(args[0]);
        if (mode === null) return "chmod: invalid mode (use octal like 644 or 755)";
        const target = normalizePath(args[1], context.cwd);
        const rootCheck = ensureRootForPath(target, context, "chmod");
        if (rootCheck) return rootCheck;

        const node = await resolveCloudNode(target);
        if (!node) return `chmod: cannot access '${args[1]}': No such file or directory`;

        const existing = getFsMetaStore(context)[normalizeMetaPath(target)] || ensureNodeMeta(target, node.type, context);
        if (!context.isRoot && existing.owner !== context.username) {
            return `chmod: changing permissions of '${args[1]}': operation not permitted`;
        }

        context.setFsMeta((prev) => ({
            ...prev,
            [normalizeMetaPath(target)]: {
                ...existing,
                mode,
            },
        }));
        return "";
    },

    chown: async (args, context) => {
        const policyCheck = ensureTerminalPermission(context, "filesystem", "chown");
        if (policyCheck) return policyCheck;
        if (args.length < 2) return "Usage: chown <owner> <path>";
        if (!context.isRoot) return "chown: operation not permitted (root required)";
        const owner = String(args[0] || "").trim();
        if (!owner) return "chown: invalid owner";
        const target = normalizePath(args[1], context.cwd);
        const node = await resolveCloudNode(target);
        if (!node) return `chown: cannot access '${args[1]}': No such file or directory`;

        const existing = getFsMetaStore(context)[normalizeMetaPath(target)] || ensureNodeMeta(target, node.type, context);
        context.setFsMeta((prev) => ({
            ...prev,
            [normalizeMetaPath(target)]: {
                ...existing,
                owner,
            },
        }));
        return "";
    },

    run: (args, { apps, packageIds, openWindow, isInstalled, isEnabled }) => {
        if (!args[0]) return "Usage: run <appId> [count]";
        const appId = args[0];
        const targetApp = apps.get(appId);
        if (!targetApp) {
            if (packageIds.includes(appId)) {
                if (!isInstalled(appId)) return `Package not installed: ${appId}. Use 'pkg install ${appId}'`;
                if (!isEnabled(appId)) return `Package disabled: ${appId}. Enable it from App Store`;
            }
            return `App not found: ${appId}`;
        }
        if (targetApp.ghost) {
            return `App '${appId}' is internal/ghost and cannot be launched manually`;
        }
        const count = parseInt(args[1]) || 1;
        for (let i = 0; i < count; i += 1) openWindow(targetApp, appId);
        return `Launched ${appId}`;
    },

    pkg: async (args, context) => {
        const action = (args[0] || "list").toLowerCase();
        const target = (args[1] || "").trim();
        const packageIds = getPackageIds(context);

        if (action === "list") return listPackages(context);
        if (action === "search") {
            const term = target.toLowerCase();
            const results = packageIds.filter((id) => id.toLowerCase().includes(term));
            return results.length ? results.join("\n") : `No package match for: ${target}`;
        }
        if (action === "install") {
            if (!target) return "Usage: pkg install <appId>";
            return installPackage(target, context);
        }
        if (action === "remove" || action === "uninstall") {
            if (!target) return "Usage: pkg remove <appId>";
            return uninstallPackage(target, context);
        }

        return "Usage: pkg <list|search|install|remove> [appId|term]";
    },

    code: async (args, context) => {
        const policyCheck = ensureTerminalPermission(context, "filesystem", "code");
        if (policyCheck) return policyCheck;
        if (!args.length) {
            return [
                "Usage:",
                "  code .",
                "  code <path>",
                "  code open <path|.>",
                "  code new [path]",
                "  code cat <file>",
                "  code write <file> <text>",
                "  code touch <file>",
                "  code rm <path>",
                "  code mkdir <path>",
                "  code ls [path]",
            ].join("\n");
        }

        const action = (args[0] || "").toLowerCase();
        const directFileOps = new Set(["cat", "write", "touch", "rm", "mkdir", "ls"]);
        if (directFileOps.has(action)) {
            return commandHandlers[action](args.slice(1), context);
        }

        const isNewWindow = action === "new" || action === "-n" || action === "--new-window";
        const isOpen = action === "open";
        const openTargetRaw = isOpen || isNewWindow ? (args[1] || ".") : (args[0] || ".");
        const openTarget = normalizePath(openTargetRaw, context.cwd);

        const vscodeApp = context.apps.get("visual-studio-code");
        if (!vscodeApp) return "code: Visual Studio Code app non disponibile";

        const node = await resolveCloudNode(openTarget);
        if (!node) return `code: cannot access '${openTargetRaw}': No such file or directory`;

        const params: Record<string, string> = {};
        if (node.type === "folder") {
            params.initialFolder = openTarget;
        } else {
            params.initialPath = openTarget;
            params.initialFolder = parentPath(openTarget);
        }

        context.openWindow(vscodeApp, "visual-studio-code", params);

        if (node.type === "folder") {
            return `VS Code opened on folder: ${openTarget}`;
        }
        return `VS Code opened file: ${openTarget}`;
    },

    secure: async (args, context) => {
        const networkPolicyCheck = ensureTerminalPermission(context, "network", "secure");
        if (networkPolicyCheck) return networkPolicyCheck;
        const sshPolicyCheck = ensureTerminalPermission(context, "ssh", "secure");
        if (sshPolicyCheck) return sshPolicyCheck;
        const action = (args[0] || "status").toLowerCase();

        if (action === "status") {
            try {
                const payload = await callSecureBrowserApi("/secure-browser/status", { method: "GET" });
                const seleniumOnline = Boolean(payload.seleniumOnline);
                const novncOnline = Boolean(payload.novncOnline);
                const online = Boolean(payload.online);
                const checkedAt = String(payload.checkedAt || "");
                return [
                    "Secure Browser status",
                    `online:   ${online ? "yes" : "no"}`,
                    `selenium: ${seleniumOnline ? "up" : "down"}`,
                    `novnc:    ${novncOnline ? "up" : "down"}`,
                    checkedAt ? `checked:  ${checkedAt}` : "",
                ].filter(Boolean).join("\n");
            } catch (error) {
                return `Secure status error: ${String(error)}`;
            }
        }

        if (action === "google") {
            try {
                const payload = await callSecureBrowserApi("/secure-browser/open-default", {
                    method: "POST",
                    body: JSON.stringify({ url: "https://www.google.com" }),
                });
                const url = String(payload.url || "https://www.google.com");
                if (!context.isInstalled("browser")) {
                    context.installApp("browser");
                }
                context.setAppEnabled("browser", true);
                const browserApp = context.apps.get("browser");
                if (browserApp) context.openWindow(browserApp, "browser");
                return `Secure browser opened on: ${url}`;
            } catch (error) {
                return `Secure open error: ${String(error)}`;
            }
        }

        if (action === "restart") {
            if (!context.isRoot) return "secure restart: permission denied (root required)";
            try {
                const payload = await callSecureBrowserApi("/secure-browser/restart", { method: "POST" });
                const online = Boolean(payload.online);
                return `Secure browser service restarted (${online ? "online" : "offline"})`;
            } catch (error) {
                return `Secure restart error: ${String(error)}`;
            }
        }

        if (action === "open" || action === "url" || action === "navigate") {
            const target = args.slice(1).join(" ").trim();
            if (!target) return "Usage: secure open <url|query>";
            const isUrl = /^https?:\/\//i.test(target) || /^[^\s]+\.[^\s]{2,}/.test(target);
            const normalized = isUrl
                ? (target.includes("://") ? target : `https://${target}`)
                : `https://www.google.com/search?q=${encodeURIComponent(target)}`;

            try {
                const payload = await callSecureBrowserApi("/secure-browser/navigate", {
                    method: "POST",
                    body: JSON.stringify({ url: normalized }),
                });
                const url = String(payload.url || normalized);
                if (!context.isInstalled("browser")) {
                    context.installApp("browser");
                }
                context.setAppEnabled("browser", true);
                const browserApp = context.apps.get("browser");
                if (browserApp) context.openWindow(browserApp, "browser");
                return `Secure browser navigated to: ${url}`;
            } catch (error) {
                return `Secure navigate error: ${String(error)}`;
            }
        }

        return "Usage: secure <status|google|open|url|restart> [target]";
    },

    ssh: async (args, context) => {
        const networkPolicyCheck = ensureTerminalPermission(context, "network", "ssh");
        if (networkPolicyCheck) return networkPolicyCheck;
        const sshPolicyCheck = ensureTerminalPermission(context, "ssh", "ssh");
        if (sshPolicyCheck) return sshPolicyCheck;

        const action = (args[0] || "").toLowerCase();
        if (action === "disconnect" || action === "exit" || action === "close") {
            if (!context.isSshSessionActive()) return "ssh: no active session";
            context.stopSshSession();
            return "ssh: session closed";
        }

        const parsed = parseSshCommandArgs(args);
        if ("error" in parsed) return parsed.error;

        return context.startSshSession({
            host: parsed.host,
            port: parsed.port,
            username: parsed.username,
            password: parsed.password,
        });
    },

    apps: (_args, { apps }) => Array.from(apps.entries())
        .filter(([, app]) => !app.ghost)
        .map(([id, app]) => `${id.padEnd(14)} ${app.name}`)
        .join("\n"),

    kill: (args, context) => {
        const rootCheck = ensureRootForAction("kill", context);
        if (rootCheck) return rootCheck;

        const id = args[0];
        if (context.windows.some((w) => w.id === id)) {
            context.closeWindow(id);
            return `Terminated window ${id}`;
        }
        if (context.windows.some((w) => w.appId === id)) {
            context.windows.filter((w) => w.appId === id).forEach((w) => context.closeWindow(w.id));
            return `Terminated all windows for ${id}`;
        }
        if (context.widgets.some((w) => w.id === id)) {
            context.widgets.filter((w) => w.id === id).forEach((w) => context.removeWidget(w.id));
            return `Terminated widget ${id}`;
        }
        return `No matching window or app: ${id}`;
    },

    ps: (_args, { windows, widgets }) => {
        const lines = [...windows.map((w) => `win ${w.id} (${w.appId})`), ...widgets.map((w) => `wdg ${w.id} (${w.widgetId})`)];
        return lines.length ? lines.join("\n") : "No processes running";
    },

    clear: (_args, { setOutput }) => {
        setOutput([]);
        return "";
    },

    exit: (_args, { closeWindow, windowId, isRoot, setIsRoot }) => {
        if (isRoot) {
            setIsRoot(false);
            return "Left root mode";
        }
        closeWindow(windowId);
        return "";
    },

    echo: (args) => args.join(" "),

    date: () => new Date().toLocaleDateString(),

    time: () => new Date().toLocaleTimeString(),

    calc: (args) => safeCalc(args.join("")),

    whoami: (_args, { isRoot, currentUser, username }) => (isRoot ? "root" : currentUser?.username || username || "user"),

    id: (_args, { isRoot, currentUser, username }) => {
        if (isRoot) return "uid=0(root) gid=0(root) groups=0(root)";
        const name = currentUser?.username || username || "user";
        return `uid=1000(${name}) gid=1000(${name}) groups=1000(${name}),27(sudo)`;
    },

    hostname: (_args, { hostname }) => hostname,

    uname: () => "Gh3OS 0.2.0-cloud x64",

    history: (args, { commands, setCommands }) => {
        if (args[0] === "clear") {
            setCommands([]);
            return "Command history cleared";
        }
        return commands.map((c, i) => `  ${i}  ${c}`).join("\n");
    },

    wallpaper: (args, context) => {
        const rootCheck = ensureRootForAction("wallpaper", context);
        if (rootCheck) return rootCheck;
        if (!args[0]) return "Usage: wallpaper <url>";
        context.setWallpaper(args[0]);
        return "Wallpaper updated";
    },

    su: (args, { isRoot, rootPassword, setIsRoot }) => {
        if (isRoot) return "Already root";
        const supplied = args[0] || "";
        if (!supplied) return "Usage: su <password>";
        if (supplied !== rootPassword) return "su: authentication failure";
        setIsRoot(true);
        return "Root session opened";
    },

    sudo: async (args, context) => {
        if (!args.length) return "Usage: sudo [-k] [-v] [-l] [-s] <command> [args...]";
        if (["-k", "-v", "-l"].includes(args[0])) return "";
        if (args[0] === "-s") {
            context.setIsRoot(true);
            return "";
        }
        const [command, ...commandArgs] = args;
        return executeAsRoot(command, commandArgs, context);
    },

    deauth: (_args, { isRoot, setIsRoot }) => {
        if (!isRoot) return "Already in user mode";
        setIsRoot(false);
        return "Switched to user mode";
    },

    passwd: (args, { isRoot, setRootPassword }) => {
        if (!isRoot) return "passwd: permission denied (root required)";
        const nextPassword = (args[0] || "").trim();
        if (!nextPassword) return "Usage: passwd <newPassword>";
        if (nextPassword.length < 4) return "passwd: password too short (min 4 chars)";
        setRootPassword(nextPassword);
        return "root password updated";
    },

    man: (args) => {
        if (!args[0]) return "Usage: man <command>";
        return COMMAND_HELP[args[0]] || `No manual entry for ${args[0]}`;
    },

    help: (args) => {
        if (args[0]) return COMMAND_HELP[args[0]] || `No help for ${args[0]}`;
        const cmds = Object.keys(commandHandlers).sort();
        const maxLen = cmds.reduce((max, cmd) => Math.max(max, cmd.length), 0);
        const lines = cmds.map((cmd) => {
            const doc = COMMAND_HELP[cmd] || cmd;
            const brief = doc.includes(" - ") ? doc.split(" - ").slice(1).join(" - ") : doc;
            return `${cmd.padEnd(maxLen)}  ${brief}`;
        });
        return ["Gh3spOS Shell", "", "Available commands:", ...lines].join("\n");
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

    calc: () => ["2+2", "10/5", "3*3", "(5+3)/2"],

    echo: () => ["Hello", "Testing terminal"],

    history: () => ["clear"],

    wallpaper: () => ["/wallpapers/default.jpg"],

    man: () => Object.keys(COMMAND_HELP),

    su: () => ["<password>"],

    sudo: () => ["-k", "-v", "-l", "-s", ...Object.keys(commandHandlers)],

    passwd: () => ["<newPassword>"],

    chmod: (args) => {
        if (args.length <= 1) return ["644", "755", "700", "600"].filter((value) => value.startsWith(args[0] || ""));
        return [];
    },

    chown: (args, ctx) => {
        if (args.length <= 1) {
            return [ctx.username, "root", "www-data"].filter((value) => value.startsWith(args[0] || ""));
        }
        return [];
    },

    secure: (args) => {
        const action = args[0] || "";
        const value = args[1] || "";
        if (!action) return ["status", "google", "open", "url", "restart"];
        if (args.length === 1) return ["status", "google", "open", "url", "restart"].filter((item) => item.startsWith(action));
        if (action === "open" || action === "url") {
            return ["google.com", "github.com", "youtube.com", "news"].filter((item) => item.startsWith(value));
        }
        return [];
    },

    pkg: (args, ctx) => {
        const action = args[0] || "";
        const value = args[1] || "";
        if (!action) return ["list", "search", "install", "remove"];
        if (args.length === 1) return ["list", "search", "install", "remove"].filter((item) => item.startsWith(action));
        if (action === "install" || action === "remove" || action === "uninstall" || action === "search") {
            return getPackageIds(ctx).filter((id) => id.startsWith(value));
        }
        return [];
    },

    code: (args) => {
        const action = args[0] || "";
        if (!action) return [".", "open", "new", "-n", "--new-window", "cat", "write", "touch", "rm", "mkdir", "ls"];
        if (args.length === 1) {
            return [".", "open", "new", "-n", "--new-window", "cat", "write", "touch", "rm", "mkdir", "ls"].filter((item) => item.startsWith(action));
        }
        return [];
    },

    ps: () => [],
    help: () => [],
    apps: () => [],
    exit: () => [],
    clear: () => [],
    pwd: () => [],
    ls: () => [],
    cd: () => [],
    mkdir: () => [],
    touch: () => [],
    cat: () => [],
    rm: () => [],
    write: () => [],
    date: () => [],
    time: () => [],
    whoami: () => [],
    id: () => [],
    hostname: () => [],
    uname: () => [],
    deauth: () => [],
};

export const getPathCompletionsForInput = async (rawInput: string, context: TerminalContext): Promise<string[]> => {
    const input = rawInput || "";
    const tokens = shellSplit(input);
    const endsWithSpace = /\s$/.test(input);

    if (!tokens.length) return [];

    let command = tokens[0] || "";
    let args = tokens.slice(1);

    if (command === "sudo" && args.length) {
        const first = args[0] || "";
        if (["-k", "-v", "-l", "-s"].includes(first) && args.length === 1 && !endsWithSpace) {
            return [];
        }
        if (["-k", "-v", "-l", "-s"].includes(first) && args.length > 1) {
            command = args[1] || "";
            args = args.slice(2);
        } else {
            command = args[0] || "";
            args = args.slice(1);
        }
    }

    if (!PATH_COMMANDS.has(command)) return [];

    const argIndex = endsWithSpace ? args.length : Math.max(0, args.length - 1);
    const currentToken = endsWithSpace ? "" : (args[args.length - 1] || "");

    if (command === "write" && argIndex > 0) return [];
    if (command === "chmod" && argIndex === 0) return [];
    if (command === "chown" && argIndex === 0) return [];
    if (command === "chown" && argIndex > 1) return [];
    if (command === "chmod" && argIndex > 1) return [];

    const onlyDirectories = command === "cd" || command === "mkdir";
    return buildPathSuggestions(currentToken, context.cwd, onlyDirectories);
};
