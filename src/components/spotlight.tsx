import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AppWindow, Bell, Compass, Search, Settings2, SlidersHorizontal, Sparkles, UserRound, Wallpaper, Wrench } from "lucide-react";
import { useApps } from "@/providers/apps";
import { useSpotlight } from "@/providers/spotlight";
import { useWindowManager } from "@/providers/window-manager";
import { usePersistentStore } from "@/providers/persistent-store";
import { useNotifications } from "@/providers/notifications";
import { DEFAULT_DESKTOP_SETTINGS, resolveDesktopSettings, type DesktopSettings } from "@/config/system-settings";

type SettingsSection = 'appearance' | 'desktop' | 'windows' | 'notifications' | 'widgets' | 'users' | 'system'
type SettingsSubTabMap = Record<SettingsSection, string>

type SpotlightItem = {
    id: string
    group: 'Actions' | 'Settings' | 'Apps' | 'Recenti'
    title: string
    subtitle: string
    icon: React.ReactNode
    keywords: string
    run: () => void
}

const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
    appearance: 'Aspetto',
    desktop: 'Desktop e Dock',
    windows: 'Finestre',
    notifications: 'Notifiche',
    widgets: 'Widget',
    users: 'Utenti e Account',
    system: 'Sistema',
}

const SETTINGS_SECTION_KEYWORDS: Record<SettingsSection, string> = {
    appearance: 'aspetto tema colori effetti accessibilità',
    desktop: 'desktop dock wallpaper sfondo',
    windows: 'finestre snapping opacità stage manager',
    notifications: 'notifiche anteprima suono dnd non disturbare',
    widgets: 'widget layout stile top bar',
    users: 'utenti account admin password',
    system: 'sistema lingua regione shortcut manutenzione',
}

const SETTINGS_SUBTAB_LABELS: Record<SettingsSection, Record<string, string>> = {
    appearance: { theme: 'Tema', effects: 'Effetti', accessibility: 'Accessibilità' },
    desktop: { wallpaper: 'Wallpaper', dock: 'Dock' },
    windows: { behavior: 'Comportamento', visual: 'Aspetto finestre' },
    notifications: { general: 'Generali', preview: 'Anteprima' },
    widgets: { layout: 'Layout', style: 'Stile', clock: 'Top Bar' },
    users: { accounts: 'Account', create: 'Crea Utente' },
    system: { regional: 'Lingua e Regione', shortcuts: 'Shortcut', maintenance: 'Manutenzione' },
}

export default function Spotlight() {
    const { isOpen, close, query, setQuery, toggle } = useSpotlight();
    const { apps } = useApps()
    const { openWindow } = useWindowManager()
    const { notify } = useNotifications()
    const [storedSettings] = usePersistentStore<DesktopSettings>('gh3sp:settings', DEFAULT_DESKTOP_SETTINGS)
    const [, setStoredSettings] = usePersistentStore<DesktopSettings>('gh3sp:settings', DEFAULT_DESKTOP_SETTINGS)
    const [, setActiveSection] = usePersistentStore<SettingsSection>('gh3sp:settings:active-section', 'appearance')
    const [, setActiveSubTabs] = usePersistentStore<SettingsSubTabMap>('gh3sp:settings:subtabs', {
        appearance: 'theme',
        desktop: 'wallpaper',
        windows: 'behavior',
        notifications: 'general',
        widgets: 'layout',
        users: 'accounts',
        system: 'regional',
    })
    const [recentSpotlightIds, setRecentSpotlightIds] = usePersistentStore<string[]>('gh3sp:spotlight:recent-items', [])
    const settings = resolveDesktopSettings(storedSettings)
    const [selectedIndex, setSelectedIndex] = useState(0)

    const trackRecent = (id: string) => {
        setRecentSpotlightIds((prev) => [id, ...prev.filter((itemId) => itemId !== id)].slice(0, 10))
    }

    const openAppById = (id: string) => {
        const app = apps.get(id)
        if (!app) return
        openWindow(app, id)
        close()
    }

    const openSettingsSubTab = (section: SettingsSection, subtab: string) => {
        setActiveSection(section)
        setActiveSubTabs((prev) => ({ ...prev, [section]: subtab }))
        openAppById('settings')
    }

    const setSetting = <K extends keyof DesktopSettings>(key: K, value: DesktopSettings[K]) => {
        setStoredSettings((prev) => ({ ...resolveDesktopSettings(prev), [key]: value }))
    }

    const actionItems: SpotlightItem[] = [
        {
            id: 'act:dnd',
            group: 'Actions',
            title: settings.doNotDisturb ? 'Disattiva Non disturbare' : 'Attiva Non disturbare',
            subtitle: 'Modalità notifiche',
            icon: <Bell className="h-4 w-4" />,
            keywords: 'dnd non disturbare notifiche modalità',
            run: () => {
                setSetting('doNotDisturb', !settings.doNotDisturb)
                notify(settings.doNotDisturb ? 'Non disturbare disattivato' : 'Non disturbare attivato', 'info')
                close()
            },
        },
        {
            id: 'act:theme',
            group: 'Actions',
            title: settings.themeMode === 'dark' ? 'Passa a tema chiaro' : 'Passa a tema scuro',
            subtitle: `Tema attuale: ${settings.themeMode}`,
            icon: <Sparkles className="h-4 w-4" />,
            keywords: 'tema dark light modalità aspetto',
            run: () => {
                setSetting('themeMode', settings.themeMode === 'dark' ? 'light' : 'dark')
                close()
            },
        },
        {
            id: 'act:spotlight-test-notification',
            group: 'Actions',
            title: 'Invia notifica di test',
            subtitle: 'Verifica anteprima, suono e durata',
            icon: <Bell className="h-4 w-4" />,
            keywords: 'test notifica notifiche preview sound durata',
            run: () => {
                notify('Notifica di test da Spotlight', 'success')
                close()
            },
        },
    ]

    const settingsItems: SpotlightItem[] = [
        {
            id: 'set:category:appearance',
            group: 'Settings',
            title: 'Apri categoria Aspetto',
            subtitle: 'Tema, colori, effetti e accessibilità',
            icon: <Sparkles className="h-4 w-4" />,
            keywords: 'categoria aspetto tema colori effetti accessibilità',
            run: () => openSettingsSubTab('appearance', 'theme'),
        },
        {
            id: 'set:category:desktop',
            group: 'Settings',
            title: 'Apri categoria Desktop e Dock',
            subtitle: 'Wallpaper, posizione e comportamento Dock',
            icon: <Wallpaper className="h-4 w-4" />,
            keywords: 'categoria desktop dock wallpaper sfondo',
            run: () => openSettingsSubTab('desktop', 'wallpaper'),
        },
        {
            id: 'set:category:windows',
            group: 'Settings',
            title: 'Apri categoria Finestre',
            subtitle: 'Snapping, opacità e comportamento finestre',
            icon: <SlidersHorizontal className="h-4 w-4" />,
            keywords: 'categoria finestre snapping opacità stage manager',
            run: () => openSettingsSubTab('windows', 'behavior'),
        },
        {
            id: 'set:category:notifications',
            group: 'Settings',
            title: 'Apri categoria Notifiche',
            subtitle: 'Generali, anteprima, suoni e durata',
            icon: <Bell className="h-4 w-4" />,
            keywords: 'categoria notifiche anteprima suono durata dnd',
            run: () => openSettingsSubTab('notifications', 'general'),
        },
        {
            id: 'set:category:widgets',
            group: 'Settings',
            title: 'Apri categoria Widget',
            subtitle: 'Layout, stile e opzioni top bar',
            icon: <Compass className="h-4 w-4" />,
            keywords: 'categoria widget layout stile top bar',
            run: () => openSettingsSubTab('widgets', 'layout'),
        },
        {
            id: 'set:category:users',
            group: 'Settings',
            title: 'Apri categoria Utenti e Account',
            subtitle: 'Gestione account e creazione utenti',
            icon: <UserRound className="h-4 w-4" />,
            keywords: 'categoria utenti account admin password crea utente',
            run: () => openSettingsSubTab('users', 'accounts'),
        },
        {
            id: 'set:category:system',
            group: 'Settings',
            title: 'Apri categoria Sistema',
            subtitle: 'Lingua, shortcut e manutenzione',
            icon: <Wrench className="h-4 w-4" />,
            keywords: 'categoria sistema lingua shortcut manutenzione',
            run: () => openSettingsSubTab('system', 'regional'),
        },
        {
            id: 'set:appearance-theme',
            group: 'Settings',
            title: 'Apri Impostazioni > Aspetto > Tema',
            subtitle: 'Personalizza tema e colore accento',
            icon: <Settings2 className="h-4 w-4" />,
            keywords: 'impostazioni aspetto tema colori accento',
            run: () => openSettingsSubTab('appearance', 'theme'),
        },
        {
            id: 'set:desktop-dock',
            group: 'Settings',
            title: 'Apri Impostazioni > Desktop e Dock',
            subtitle: 'Posizione, auto-hide e dimensioni dock',
            icon: <Compass className="h-4 w-4" />,
            keywords: 'impostazioni dock desktop posizione auto hide',
            run: () => openSettingsSubTab('desktop', 'dock'),
        },
        {
            id: 'set:windows-behavior',
            group: 'Settings',
            title: 'Apri Impostazioni > Finestre',
            subtitle: 'Snapping, stage manager e opacità',
            icon: <SlidersHorizontal className="h-4 w-4" />,
            keywords: 'impostazioni finestre snapping opacità stage manager',
            run: () => openSettingsSubTab('windows', 'behavior'),
        },
        {
            id: 'set:notifications',
            group: 'Settings',
            title: 'Apri Impostazioni > Notifiche',
            subtitle: 'Preview, durata, suono e non disturbare',
            icon: <Bell className="h-4 w-4" />,
            keywords: 'impostazioni notifiche durata suono preview dnd',
            run: () => openSettingsSubTab('notifications', 'general'),
        },
        {
            id: 'set:appearance-effects',
            group: 'Settings',
            title: 'Apri Impostazioni > Aspetto > Effetti',
            subtitle: 'Riduci trasparenze, riduci animazioni e blur',
            icon: <Sparkles className="h-4 w-4" />,
            keywords: 'effetti riduci trasparenza riduci motion animazioni blur',
            run: () => openSettingsSubTab('appearance', 'effects'),
        },
        {
            id: 'set:desktop-wallpaper',
            group: 'Settings',
            title: 'Apri Impostazioni > Desktop e Dock > Wallpaper',
            subtitle: 'Scegli sfondo desktop',
            icon: <Wallpaper className="h-4 w-4" />,
            keywords: 'wallpaper sfondo background desktop',
            run: () => openSettingsSubTab('desktop', 'wallpaper'),
        },
        {
            id: 'set:windows-visual',
            group: 'Settings',
            title: 'Apri Impostazioni > Finestre > Aspetto',
            subtitle: 'Opacità e resa visiva delle finestre',
            icon: <SlidersHorizontal className="h-4 w-4" />,
            keywords: 'opacità finestra trasparenza aspetto visual',
            run: () => openSettingsSubTab('windows', 'visual'),
        },
        {
            id: 'set:notifications-preview',
            group: 'Settings',
            title: 'Apri Impostazioni > Notifiche > Anteprima',
            subtitle: 'Quando mostrare il contenuto notifiche',
            icon: <Bell className="h-4 w-4" />,
            keywords: 'notifiche anteprima always locked never',
            run: () => openSettingsSubTab('notifications', 'preview'),
        },
        {
            id: 'set:widgets-layout',
            group: 'Settings',
            title: 'Apri Impostazioni > Widget > Layout',
            subtitle: 'Colonne griglia e opacità widget',
            icon: <Compass className="h-4 w-4" />,
            keywords: 'widget layout colonne griglia opacità',
            run: () => openSettingsSubTab('widgets', 'layout'),
        },
        {
            id: 'set:widgets-style',
            group: 'Settings',
            title: 'Apri Impostazioni > Widget > Stile',
            subtitle: 'Blur e bordi accentati',
            icon: <Compass className="h-4 w-4" />,
            keywords: 'widget stile blur bordi accentati',
            run: () => openSettingsSubTab('widgets', 'style'),
        },
        {
            id: 'set:system-regional',
            group: 'Settings',
            title: 'Apri Impostazioni > Sistema > Lingua e Regione',
            subtitle: 'Lingua interfaccia e formati locali',
            icon: <Wrench className="h-4 w-4" />,
            keywords: 'sistema lingua regione locale it en',
            run: () => openSettingsSubTab('system', 'regional'),
        },
        {
            id: 'set:system-shortcuts',
            group: 'Settings',
            title: 'Apri Impostazioni > Sistema > Shortcut',
            subtitle: 'Abilita Spotlight e scorciatoia tastiera',
            icon: <Wrench className="h-4 w-4" />,
            keywords: 'shortcut scorciatoia spotlight cmd space alt space',
            run: () => openSettingsSubTab('system', 'shortcuts'),
        },
        {
            id: 'set:users-create',
            group: 'Settings',
            title: 'Apri Impostazioni > Utenti e Account > Crea Utente',
            subtitle: 'Aggiungi un nuovo utente',
            icon: <UserRound className="h-4 w-4" />,
            keywords: 'utenti account crea nuovo utente admin',
            run: () => openSettingsSubTab('users', 'create'),
        },
        {
            id: 'set:system-maintenance',
            group: 'Settings',
            title: 'Apri Impostazioni > Sistema > Manutenzione',
            subtitle: 'Ripristino preferenze',
            icon: <Wrench className="h-4 w-4" />,
            keywords: 'manutenzione reset ripristina impostazioni',
            run: () => openSettingsSubTab('system', 'maintenance'),
        },
        ...(
            (Object.keys(SETTINGS_SECTION_LABELS) as SettingsSection[]).flatMap((section) =>
                Object.entries(SETTINGS_SUBTAB_LABELS[section]).map(([subtabId, subtabLabel]) => ({
                    id: `set:auto:${section}:${subtabId}`,
                    group: 'Settings' as const,
                    title: `Apri ${SETTINGS_SECTION_LABELS[section]} > ${subtabLabel}`,
                    subtitle: `Sezione ${SETTINGS_SECTION_LABELS[section]}`,
                    icon: <Settings2 className="h-4 w-4" />,
                    keywords: `${SETTINGS_SECTION_LABELS[section].toLowerCase()} ${subtabLabel.toLowerCase()} ${SETTINGS_SECTION_KEYWORDS[section]}`,
                    run: () => openSettingsSubTab(section, subtabId),
                }))
            )
        ),
    ]

    const appItems: SpotlightItem[] = [...apps.entries()]
        .filter(([, app]) => !app.ghost)
        .map(([id, app]) => ({
            id: `app:${id}`,
            group: 'Apps' as const,
            title: app.name,
            subtitle: `Apri app ${app.name}`,
            icon: typeof app.icon === 'string'
                ? <img src={`/apps/${app.icon}`} alt={app.name} className="w-4 h-4 rounded-sm" draggable={false} />
                : <AppWindow className="h-4 w-4" />,
            keywords: `${app.name.toLowerCase()} app open apri`,
            run: () => openAppById(id),
        }))

    const allItems = useMemo(() => {
        const base = [...actionItems, ...settingsItems, ...appItems]
        return base.map((item) => ({
            ...item,
            run: () => {
                trackRecent(item.id)
                item.run()
            },
        }))
    }, [actionItems, appItems, settingsItems])

    const recentItems = useMemo(() => {
        const lookup = new Map(allItems.map((item) => [item.id, item]))
        return recentSpotlightIds
            .map((id) => lookup.get(id))
            .filter((item): item is SpotlightItem => !!item)
            .map((item) => ({ ...item, group: 'Recenti' as const }))
            .slice(0, 6)
    }, [allItems, recentSpotlightIds])

    const primaryItems = useMemo(() => {
        const priorityIds = [
            'act:dnd',
            'act:theme',
            'set:category:appearance',
            'set:category:desktop',
            'set:category:notifications',
            'set:category:system',
            'app:settings',
            'app:terminal',
            'app:browser',
        ]

        const lookup = new Map(allItems.map((item) => [item.id, item]))
        const prioritized = priorityIds
            .map((id) => lookup.get(id))
            .filter((item): item is SpotlightItem => !!item)

        const fallbackApps = allItems.filter((item) => item.group === 'Apps').slice(0, 4)
        return [...prioritized, ...fallbackApps]
    }, [allItems])

    const results = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) {
            const combined = [...recentItems, ...primaryItems]
            const unique = combined.filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index)
            return unique.slice(0, 14)
        }

        return allItems
            .filter((item) => item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q) || item.keywords.includes(q))
            .slice(0, 20)
    }, [allItems, primaryItems, query, recentItems])

    const grouped = useMemo(() => {
        return {
            Recenti: results.filter((item) => item.group === 'Recenti'),
            Actions: results.filter((item) => item.group === 'Actions'),
            Settings: results.filter((item) => item.group === 'Settings'),
            Apps: results.filter((item) => item.group === 'Apps'),
        }
    }, [results])

    const sectionOrder = useMemo(() => {
        if (!query.trim()) return ['Recenti', 'Actions', 'Settings', 'Apps'] as const
        return ['Actions', 'Settings', 'Apps'] as const
    }, [query])
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!settings.spotlightEnabled) return

            const wantsCmdSpace = settings.spotlightShortcut === 'cmd-space'
            const trigger = wantsCmdSpace ? (e.metaKey || e.ctrlKey) && e.code === "Space" : e.altKey && e.code === 'Space'

            if (trigger) {
                e.preventDefault();
                toggle();
                return
            }

            if (!isOpen) return

            if (e.code === "Escape") {
                close()
                return
            }

            if (e.code === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex((prev) => Math.min(results.length - 1, prev + 1))
                return
            }

            if (e.code === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex((prev) => Math.max(0, prev - 1))
                return
            }

            if (e.code === 'Enter') {
                e.preventDefault()
                results[selectedIndex]?.run()
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [close, isOpen, results, selectedIndex, settings.spotlightEnabled, settings.spotlightShortcut, toggle]);

    useEffect(() => {
        setSelectedIndex(0)
    }, [query, isOpen])

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/55 z-[100] flex items-start justify-center p-4" onClick={close}>
            <motion.div
                className="mt-16 bg-black/45 backdrop-blur-2xl rounded-2xl w-full max-w-2xl border border-white/20 shadow-2xl overflow-hidden"
                initial={{ opacity: 0, scale: 0.97, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -8 }}
                transition={{ duration: settings.reduceMotion ? 0 : 0.16 }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/15 bg-white/5">
                    <Search className="h-4 w-4 text-white/60" />
                    <input
                        className="w-full bg-transparent text-white text-lg outline-none placeholder:text-white/50"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                        placeholder="Cerca app, impostazioni e azioni rapide..."
                    />
                </div>

                <div className="max-h-[65vh] overflow-auto custom-scroll px-2 py-2">
                    {(sectionOrder).map((groupKey) => (
                        grouped[groupKey].length > 0 ? (
                            <div key={groupKey} className="mb-2">
                                <div className="px-2 pt-2 pb-1 text-[11px] uppercase tracking-wider text-white/45">{groupKey}</div>
                                <ul className="space-y-1">
                                    {grouped[groupKey].map((item) => {
                                        const absoluteIndex = results.findIndex((r) => r.id === item.id)
                                        const selected = absoluteIndex === selectedIndex
                                        return (
                                            <li
                                                key={item.id}
                                                onMouseEnter={() => setSelectedIndex(absoluteIndex)}
                                                onClick={() => item.run()}
                                                className={`cursor-pointer rounded-xl px-3 py-2 flex items-center gap-3 border transition ${selected ? 'bg-white/20 border-white/25' : 'bg-white/[0.03] border-transparent hover:bg-white/10'}`}
                                            >
                                                <div className="h-7 w-7 rounded-lg bg-white/10 border border-white/15 grid place-items-center text-white/80">
                                                    {item.icon}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm text-white truncate">{item.title}</p>
                                                    <p className="text-xs text-white/55 truncate">{item.subtitle}</p>
                                                </div>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </div>
                        ) : null
                    ))}

                    {results.length === 0 && (
                        <div className="px-4 py-10 text-center text-white/55 text-sm">
                            Nessun risultato per “{query}”
                        </div>
                    )}
                </div>

                <div className="px-4 py-2 border-t border-white/10 bg-white/[0.03] text-[11px] text-white/50 flex items-center justify-between">
                    <span>↑ ↓ naviga · Invio esegue</span>
                    <span>Esc chiude</span>
                </div>
            </motion.div>
        </div>
    );
}
