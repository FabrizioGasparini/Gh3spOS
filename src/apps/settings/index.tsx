import React, { useMemo, useState } from 'react'
import { Bell, BellRing, Brush, ChevronDown, ChevronRight, Globe, HardDrive, KeyRound, LayoutTemplate, MonitorSmartphone, Play, Search, ShieldAlert, ShieldCheck, SlidersHorizontal, Sparkles, UserRound, Wallpaper as WallpaperIcon, Wrench } from 'lucide-react'
import { usePersistentStore } from '@/providers/persistent-store'
import { useAuth } from '@/providers/auth'
import { useNotifications } from '@/providers/notifications'
import { useApps, type AppPermissionKey } from '@/providers/apps'
import {
  ACCENT_COLOR_VALUES,
  DEFAULT_DESKTOP_SETTINGS,
  resolveDesktopSettings,
  SYSTEM_SETTINGS_LABELS,
  SYSTEM_SETTINGS_LIMITS,
  SYSTEM_SETTINGS_OPTIONS,
  WALLPAPER_CHOICES,
  type DesktopSettings,
} from '@/config/system-settings'

type SettingsSection =
  | 'appearance'
  | 'desktop'
  | 'windows'
  | 'notifications'
  | 'widgets'
  | 'users'
  | 'system'

type SubTabMap = Record<SettingsSection, string>

type SettingsSearchItem = {
  id: string
  label: string
  section: SettingsSection
  subtab: string
  keywords: string
}

const SECTION_ITEMS: Array<{ id: SettingsSection; label: string; icon: React.ReactNode }> = [
  { id: 'appearance', label: 'Aspetto', icon: <Brush className="h-4 w-4" /> },
  { id: 'desktop', label: 'Desktop e Dock', icon: <WallpaperIcon className="h-4 w-4" /> },
  { id: 'windows', label: 'Finestre', icon: <LayoutTemplate className="h-4 w-4" /> },
  { id: 'notifications', label: 'Notifiche', icon: <Bell className="h-4 w-4" /> },
  { id: 'widgets', label: 'Widget', icon: <Sparkles className="h-4 w-4" /> },
  { id: 'users', label: 'Utenti e Account', icon: <UserRound className="h-4 w-4" /> },
  { id: 'system', label: 'Sistema', icon: <Wrench className="h-4 w-4" /> },
]

const SUBTAB_ITEMS: Record<SettingsSection, Array<{ id: string; label: string }>> = {
  appearance: [
    { id: 'theme', label: 'Tema' },
    { id: 'effects', label: 'Effetti' },
    { id: 'accessibility', label: 'Accessibilità' },
  ],
  desktop: [
    { id: 'wallpaper', label: 'Wallpaper' },
    { id: 'dock', label: 'Dock' },
  ],
  windows: [
    { id: 'behavior', label: 'Comportamento' },
    { id: 'visual', label: 'Aspetto' },
  ],
  notifications: [
    { id: 'general', label: 'Generali' },
    { id: 'preview', label: 'Anteprima' },
  ],
  widgets: [
    { id: 'layout', label: 'Layout' },
    { id: 'style', label: 'Stile' },
    { id: 'clock', label: 'Top Bar' },
  ],
  users: [
    { id: 'accounts', label: 'Account' },
    { id: 'create', label: 'Crea Utente' },
  ],
  system: [
    { id: 'regional', label: 'Lingua e Regione' },
    { id: 'shortcuts', label: 'Shortcut' },
    { id: 'permissions', label: 'Permessi app' },
    { id: 'maintenance', label: 'Manutenzione' },
  ],
}

const DEFAULT_SUBTABS: SubTabMap = {
  appearance: 'theme',
  desktop: 'wallpaper',
  windows: 'behavior',
  notifications: 'general',
  widgets: 'layout',
  users: 'accounts',
  system: 'regional',
}

const SETTINGS_SEARCH_INDEX: SettingsSearchItem[] = [
  { id: 'themeMode', label: 'Modalità interfaccia', section: 'appearance', subtab: 'theme', keywords: 'tema dark light auto aspetto' },
  { id: 'accentColor', label: 'Colore accento', section: 'appearance', subtab: 'theme', keywords: 'colore accento blu viola verde arancione rosa' },
  { id: 'themeEngineTimeAwareAuto', label: 'Auto tema in base all\'orario', section: 'appearance', subtab: 'theme', keywords: 'tema auto orario giorno notte' },
  { id: 'themeEngineDynamicAccent', label: 'Accento dinamico', section: 'appearance', subtab: 'theme', keywords: 'accento dinamico theme engine' },
  { id: 'reduceTransparency', label: 'Riduci trasparenza', section: 'appearance', subtab: 'effects', keywords: 'accessibilità effetti trasparenza' },
  { id: 'reduceMotion', label: 'Riduci animazioni', section: 'appearance', subtab: 'effects', keywords: 'accessibilità motion animazioni' },
  { id: 'wallpaperOverlay', label: 'Intensità overlay wallpaper', section: 'appearance', subtab: 'effects', keywords: 'overlay wallpaper sfondo' },
  { id: 'wallpaperBlur', label: 'Blur wallpaper', section: 'appearance', subtab: 'effects', keywords: 'blur wallpaper sfondo' },
  { id: 'menuBarCompact', label: 'Menu bar compatta', section: 'appearance', subtab: 'accessibility', keywords: 'menu bar compatta topbar' },
  { id: 'menuBarShowFocusedApp', label: 'Mostra app in focus nella menu bar', section: 'appearance', subtab: 'accessibility', keywords: 'menu bar focus app attiva' },
  { id: 'wallpaper', label: 'Sfondo desktop', section: 'desktop', subtab: 'wallpaper', keywords: 'wallpaper sfondo desktop' },
  { id: 'dockMagnification', label: 'Ingrandimento Dock', section: 'desktop', subtab: 'dock', keywords: 'dock magnification ingrandimento' },
  { id: 'dockAutoHide', label: 'Auto-hide Dock', section: 'desktop', subtab: 'dock', keywords: 'dock nascondi automatico' },
  { id: 'dockIconSize', label: 'Dimensione icone Dock', section: 'desktop', subtab: 'dock', keywords: 'dock dimensione icone size' },
  { id: 'dockPosition', label: 'Posizione Dock', section: 'desktop', subtab: 'dock', keywords: 'dock sinistra destra basso posizione' },
  { id: 'windowSnapping', label: 'Aggancio finestre (snapping)', section: 'windows', subtab: 'behavior', keywords: 'finestre snapping aggancio' },
  { id: 'stageManager', label: 'Stage Manager', section: 'windows', subtab: 'behavior', keywords: 'finestre stage manager' },
  { id: 'openAppsOnBoot', label: "Riapri app all'avvio", section: 'windows', subtab: 'behavior', keywords: 'avvio boot riapri app' },
  { id: 'windowOpacity', label: 'Opacità finestre', section: 'windows', subtab: 'visual', keywords: 'finestre opacità trasparenza' },
  { id: 'notificationsEnabled', label: 'Notifiche abilitate', section: 'notifications', subtab: 'general', keywords: 'notifiche abilita' },
  { id: 'doNotDisturb', label: 'Non disturbare', section: 'notifications', subtab: 'general', keywords: 'dnd n.d. non disturbare' },
  { id: 'notificationSound', label: 'Suono notifiche', section: 'notifications', subtab: 'general', keywords: 'notifiche suono audio' },
  { id: 'notificationCenterCompact', label: 'Centro notifiche compatto', section: 'notifications', subtab: 'general', keywords: 'centro notifiche compatto' },
  { id: 'notificationCenterShowBadge', label: 'Badge non lette in top bar', section: 'notifications', subtab: 'general', keywords: 'badge top bar non lette' },
  { id: 'notificationCenterAccentColors', label: 'Colori accenti notifiche', section: 'notifications', subtab: 'general', keywords: 'notifiche colori accenti bordo' },
  { id: 'notificationDuration', label: 'Durata notifiche', section: 'notifications', subtab: 'general', keywords: 'notifiche durata secondi' },
  { id: 'notificationCenterMaxItems', label: 'Notifiche visibili nel centro', section: 'notifications', subtab: 'general', keywords: 'notifiche centro limite max' },
  { id: 'notificationsPreview', label: 'Anteprima notifiche', section: 'notifications', subtab: 'preview', keywords: 'notifiche anteprima always locked never' },
  { id: 'widgetsColumns', label: 'Colonne griglia widget', section: 'widgets', subtab: 'layout', keywords: 'widget colonne griglia' },
  { id: 'widgetsOpacity', label: 'Opacità widget', section: 'widgets', subtab: 'layout', keywords: 'widget opacità' },
  { id: 'widgetsBlur', label: 'Blur sui widget', section: 'widgets', subtab: 'style', keywords: 'widget blur' },
  { id: 'widgetsAccentBorders', label: 'Bordi accentati', section: 'widgets', subtab: 'style', keywords: 'widget bordi accenti' },
  { id: 'clockUse24h', label: 'Orario 24h', section: 'widgets', subtab: 'clock', keywords: 'orologio 24h ora' },
  { id: 'clockShowWeekday', label: 'Mostra giorno della settimana', section: 'widgets', subtab: 'clock', keywords: 'orologio giorno settimana' },
  { id: 'clockShowSeconds', label: 'Mostra secondi', section: 'widgets', subtab: 'clock', keywords: 'orologio secondi' },
  { id: 'language', label: 'Lingua e regione', section: 'system', subtab: 'regional', keywords: 'lingua regione locale' },
  { id: 'spotlightEnabled', label: 'Abilita Spotlight', section: 'system', subtab: 'shortcuts', keywords: 'spotlight abilita' },
  { id: 'spotlightShortcut', label: 'Scorciatoia Spotlight', section: 'system', subtab: 'shortcuts', keywords: 'spotlight shortcut cmd ctrl alt space' },
  { id: 'permissions', label: 'Permessi applicazioni', section: 'system', subtab: 'permissions', keywords: 'permessi app sicurezza launch rete file ssh notifiche' },
  { id: 'maintenance', label: 'Ripristina impostazioni', section: 'system', subtab: 'maintenance', keywords: 'ripristina reset manutenzione' },
  { id: 'usersCurrent', label: 'Utente corrente', section: 'users', subtab: 'accounts', keywords: 'utente account corrente' },
  { id: 'usersList', label: 'Utenti disponibili', section: 'users', subtab: 'accounts', keywords: 'utenti disponibili lista' },
  { id: 'usersCreate', label: 'Crea nuovo utente', section: 'users', subtab: 'create', keywords: 'crea utente admin account' },
]

const ToggleRow = ({
  label,
  description,
  checked,
  onChange,
  accentColor,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (next: boolean) => void
  accentColor: string
}) => (
  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
    <div>
      <p className="text-sm font-medium text-white/90">{label}</p>
      {description && <p className="text-xs text-white/55 mt-0.5">{description}</p>}
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-all duration-300 ease-out border ${checked ? 'border-white/40 shadow-[0_0_0_3px_rgba(255,255,255,0.18)]' : 'bg-white/20 border-white/20'}`}
      style={checked ? { backgroundColor: accentColor } : undefined}
      aria-pressed={checked}
    >
      <span className={`flex h-full items-center px-[2px] ${checked ? 'justify-end' : 'justify-start'} transition-all duration-300 ease-out`}>
        <span className="h-5 w-5 rounded-full bg-white shadow-md" />
      </span>
    </button>
  </div>
)

const SliderRow = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix = '',
  accentColor,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (next: number) => void
  suffix?: string
  accentColor: string
}) => (
  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-white/90">{label}</p>
      <span className="text-xs text-white/60">{value}{suffix}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="mt-3 w-full"
      style={{ accentColor }}
    />
  </div>
)

export const Settings: React.FC<{ windowId: string }> = () => {
  const [activeSection, setActiveSection] = usePersistentStore<SettingsSection>('gh3sp:settings:active-section', 'appearance')
  const [activeSubTabs, setActiveSubTabs] = usePersistentStore<SubTabMap>('gh3sp:settings:subtabs', DEFAULT_SUBTABS)
  const [rawSettings, setSettings] = usePersistentStore<DesktopSettings>('gh3sp:settings', DEFAULT_DESKTOP_SETTINGS)
  const { users, currentUser, isAdmin, createUser } = useAuth()
  const { notify } = useNotifications()
  const { permissionTargets, permissionKeys, getPermission, canUsePermission, isPermissionLocked, setPermission, resetPermissions } = useApps()

  const settings = useMemo(() => resolveDesktopSettings(rawSettings), [rawSettings])
  const sectionTitle = useMemo(() => SECTION_ITEMS.find((item) => item.id === activeSection)?.label ?? 'Impostazioni', [activeSection])

  const currentSubTab = activeSubTabs[activeSection] ?? SUBTAB_ITEMS[activeSection][0].id
  const currentSubTabLabel = SUBTAB_ITEMS[activeSection].find((tab) => tab.id === currentSubTab)?.label ?? currentSubTab

  const accentColor = ACCENT_COLOR_VALUES[settings.accentColor]

  const [newDisplayName, setNewDisplayName] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user')
  const [userCreateMessage, setUserCreateMessage] = useState<string | null>(null)
  const [settingsQuery, setSettingsQuery] = useState('')
  const [expandedPermissionApp, setExpandedPermissionApp] = usePersistentStore<string | null>('gh3sp:settings:expanded-permission-app', null)

  const updateSetting = <K extends keyof DesktopSettings,>(key: K, value: DesktopSettings[K]) => {
    setSettings((prev) => ({ ...resolveDesktopSettings(prev), [key]: value }))
  }

  const setSubTab = (section: SettingsSection, tabId: string) => {
    setActiveSubTabs((prev) => ({ ...prev, [section]: tabId }))
  }

  const normalizedQuery = settingsQuery.trim().toLowerCase()

  const settingSearchResults = useMemo(() => {
    if (!normalizedQuery) return []
    return SETTINGS_SEARCH_INDEX.filter((item) =>
      item.label.toLowerCase().includes(normalizedQuery)
      || item.keywords.includes(normalizedQuery)
      || SECTION_ITEMS.find((s) => s.id === item.section)?.label.toLowerCase().includes(normalizedQuery)
      || SUBTAB_ITEMS[item.section].find((t) => t.id === item.subtab)?.label.toLowerCase().includes(normalizedQuery)
    ).slice(0, 24)
  }, [normalizedQuery])

  const goToSettingResult = (item: SettingsSearchItem) => {
    setActiveSection(item.section)
    setSubTab(item.section, item.subtab)
    setSettingsQuery('')
  }

  const handleCreateUser = () => {
    setUserCreateMessage(null)
    const result = createUser({
      displayName: newDisplayName,
      username: newUsername,
      password: newPassword,
      role: newRole,
    })

    if (!result.ok) {
      setUserCreateMessage(result.error ?? 'Errore creazione utente')
      return
    }

    setUserCreateMessage('Utente creato correttamente')
    setNewDisplayName('')
    setNewUsername('')
    setNewPassword('')
    setNewRole('user')
  }

  const resetSettings = () => {
    setSettings(DEFAULT_DESKTOP_SETTINGS)
  }

  const sectionCardClass = 'rounded-2xl border border-white/10 bg-white/[0.03] p-4'

  const permissionLabels: Record<AppPermissionKey, string> = {
    launch: 'Avvio app',
    filesystem: 'File system',
    network: 'Rete',
    ssh: 'SSH',
    notifications: 'Notifiche',
  }

  const permissionIcons: Record<AppPermissionKey, React.ReactNode> = {
    launch: <Play className="h-3.5 w-3.5" />,
    filesystem: <HardDrive className="h-3.5 w-3.5" />,
    network: <Globe className="h-3.5 w-3.5" />,
    ssh: <KeyRound className="h-3.5 w-3.5" />,
    notifications: <BellRing className="h-3.5 w-3.5" />,
  }

  const sendTestNotification = (type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    if (!canUsePermission('settings', 'notifications')) return
    const time = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    notify(`Notifica di test (${type}) • ${time}`, type)
  }

  return (
    <div className="h-full w-full border border-white/10 bg-black/20 text-white overflow-hidden backdrop-blur-2xl">
      <div className="grid h-full grid-cols-[260px_1fr]">
        <aside className="border-r border-white/10 bg-white/[0.04] p-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 mb-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Gh3spOS Settings</p>
            <p className="text-sm font-medium mt-0.5 text-white/90">Preferenze di sistema</p>
          </div>

          <nav className="space-y-1">
            {SECTION_ITEMS.map((section) => (
              <div key={section.id} className="rounded-lg">
                <button
                  onClick={() => {
                    setActiveSection(section.id)
                    if (!SUBTAB_ITEMS[section.id].some((t) => t.id === (activeSubTabs[section.id] ?? ''))) {
                      setSubTab(section.id, SUBTAB_ITEMS[section.id][0].id)
                    }
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                    activeSection === section.id
                      ? 'border text-white'
                      : 'hover:bg-white/10 text-white/80 border border-transparent'
                  }`}
                  style={activeSection === section.id ? { backgroundColor: `${accentColor}66`, borderColor: `${accentColor}AA` } : undefined}
                >
                  {section.icon}
                  <span className="flex-1 text-left">{section.label}</span>
                  <span className={`text-xs transition ${activeSection === section.id ? 'rotate-90 text-white/90' : 'text-white/45'}`}>›</span>
                </button>

                {activeSection === section.id && (
                  <div className="mt-1 ml-3 pl-2 border-l border-white/10 space-y-1 animate-fadeIn">
                    {SUBTAB_ITEMS[section.id].map((subtab) => {
                      const isSubActive = currentSubTab === subtab.id
                      return (
                        <button
                          key={subtab.id}
                          onClick={() => setSubTab(section.id, subtab.id)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs border transition ${
                            isSubActive
                              ? 'text-white border-white/40'
                              : 'text-white/70 border-transparent hover:bg-white/8'
                          }`}
                          style={isSubActive ? { backgroundColor: `${accentColor}40` } : undefined}
                        >
                          {subtab.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </aside>

        <main className="h-full overflow-auto p-6 custom-scroll">
          <div className="top-0 z-20 mb-5 rounded-xl border border-white/10 bg-black/35 backdrop-blur-xl px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Pannello</p>
                <h2 className="text-xl font-semibold text-white/95">{sectionTitle}</h2>
                <p className="text-xs text-white/65 mt-0.5">{sectionTitle} · {currentSubTabLabel}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 min-w-[250px]">
                  <Search className="h-3.5 w-3.5 text-white/55" />
                  <input
                    value={settingsQuery}
                    onChange={(e) => setSettingsQuery(e.target.value)}
                    placeholder="Cerca singola impostazione..."
                    className="w-full bg-transparent outline-none placeholder:text-white/45"
                  />
                </label>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60">
                  <MonitorSmartphone className="h-3.5 w-3.5" />
                  OS build 1.0.0
                </div>
            
              </div>
            </div>
          </div>

          {normalizedQuery && (
            <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs text-white/60 mb-2">Risultati ricerca impostazioni</p>
              {settingSearchResults.length === 0 ? (
                <p className="text-sm text-white/55 px-2 py-3">Nessuna impostazione trovata per “{settingsQuery}”.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-auto custom-scroll pr-1">
                  {settingSearchResults.map((result) => {
                    const sectionLabel = SECTION_ITEMS.find((s) => s.id === result.section)?.label ?? result.section
                    const subtabLabel = SUBTAB_ITEMS[result.section].find((t) => t.id === result.subtab)?.label ?? result.subtab
                    return (
                      <button
                        key={result.id}
                        onClick={() => goToSettingResult(result)}
                        className="w-full text-left rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] px-3 py-2 transition"
                      >
                        <p className="text-sm text-white/90">{result.label}</p>
                        <p className="text-[11px] text-white/55 mt-0.5">{sectionLabel} · {subtabLabel}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {!normalizedQuery && activeSection === 'appearance' && currentSubTab === 'theme' && (
            <div className="space-y-3">
              <div className={sectionCardClass}>
                <h3 className="text-sm font-semibold mb-3">Tema e colori</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="text-sm text-white/80">
                    <span className="block mb-1.5 text-white/60 text-xs">Modalità interfaccia</span>
                    <select
                      value={settings.themeMode}
                      onChange={(e) => updateSetting('themeMode', e.target.value as DesktopSettings['themeMode'])}
                      className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30"
                    >
                      {SYSTEM_SETTINGS_OPTIONS.themeMode.map((mode) => (
                        <option key={mode} value={mode} className="bg-slate-900">{SYSTEM_SETTINGS_LABELS.themeMode[mode]}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm text-white/80">
                    <span className="block mb-1.5 text-white/60 text-xs">Colore accento</span>
                    <select
                      value={settings.accentColor}
                      onChange={(e) => updateSetting('accentColor', e.target.value as DesktopSettings['accentColor'])}
                      className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30"
                    >
                      {SYSTEM_SETTINGS_OPTIONS.accentColor.map((color) => (
                        <option key={color} value={color} className="bg-slate-900">{SYSTEM_SETTINGS_LABELS.accentColor[color]}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <ToggleRow
                label="Auto tema in base all'orario"
                description="Con tema Auto, usa giorno/notte invece del tema di sistema"
                checked={settings.themeEngineTimeAwareAuto}
                onChange={(v) => updateSetting('themeEngineTimeAwareAuto', v)}
                accentColor={accentColor}
              />
              <ToggleRow
                label="Accento dinamico"
                description="Adatta intensità dell'accento in base alla fase giorno/notte"
                checked={settings.themeEngineDynamicAccent}
                onChange={(v) => updateSetting('themeEngineDynamicAccent', v)}
                accentColor={accentColor}
              />
            </div>
          )}

          {!normalizedQuery && activeSection === 'appearance' && currentSubTab === 'effects' && (
            <div className="space-y-3">
              <ToggleRow label="Riduci trasparenza" checked={settings.reduceTransparency} onChange={(v) => updateSetting('reduceTransparency', v)} accentColor={accentColor} />
              <ToggleRow label="Riduci animazioni" checked={settings.reduceMotion} onChange={(v) => updateSetting('reduceMotion', v)} accentColor={accentColor} />
              <SliderRow label="Intensità overlay wallpaper" value={settings.wallpaperOverlay} min={SYSTEM_SETTINGS_LIMITS.wallpaperOverlay.min} max={SYSTEM_SETTINGS_LIMITS.wallpaperOverlay.max} step={SYSTEM_SETTINGS_LIMITS.wallpaperOverlay.step} onChange={(v) => updateSetting('wallpaperOverlay', v)} suffix="%" accentColor={accentColor} />
              <SliderRow label="Blur wallpaper" value={settings.wallpaperBlur} min={SYSTEM_SETTINGS_LIMITS.wallpaperBlur.min} max={SYSTEM_SETTINGS_LIMITS.wallpaperBlur.max} step={SYSTEM_SETTINGS_LIMITS.wallpaperBlur.step} onChange={(v) => updateSetting('wallpaperBlur', v)} suffix="px" accentColor={accentColor} />
            </div>
          )}

          {!normalizedQuery && activeSection === 'appearance' && currentSubTab === 'accessibility' && (
            <div className="space-y-3">
              <ToggleRow label="Menu bar compatta" checked={settings.menuBarCompact} onChange={(v) => updateSetting('menuBarCompact', v)} accentColor={accentColor} />
              <ToggleRow label="Mostra app in focus nella menu bar" checked={settings.menuBarShowFocusedApp} onChange={(v) => updateSetting('menuBarShowFocusedApp', v)} accentColor={accentColor} />
            </div>
          )}

          {!normalizedQuery && activeSection === 'desktop' && currentSubTab === 'wallpaper' && (
            <div className="space-y-3">
              <div className={sectionCardClass}>
                <h3 className="text-sm font-semibold mb-3">Sfondo desktop</h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  {WALLPAPER_CHOICES.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => updateSetting('wallpaper', item.id)}
                      className={`rounded-xl overflow-hidden border transition ${settings.wallpaper === item.id ? 'ring-2' : 'border-white/15 hover:border-white/30'}`}
                      style={settings.wallpaper === item.id ? { borderColor: `${accentColor}CC`, boxShadow: `0 0 0 2px ${accentColor}55` } : undefined}
                    >
                      <div className="h-24 bg-cover bg-center" style={{ backgroundImage: `url(${item.id})` }} />
                      <div className="px-2 py-1.5 text-xs text-left bg-black/20">{item.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!normalizedQuery && activeSection === 'desktop' && currentSubTab === 'dock' && (
            <div className="space-y-3">
              <ToggleRow label="Ingrandimento Dock" checked={settings.dockMagnification} onChange={(v) => updateSetting('dockMagnification', v)} accentColor={accentColor} />
              <ToggleRow label="Auto-hide Dock" checked={settings.dockAutoHide} onChange={(v) => updateSetting('dockAutoHide', v)} accentColor={accentColor} />
              <SliderRow label="Dimensione icone Dock" value={settings.dockIconSize} min={SYSTEM_SETTINGS_LIMITS.dockIconSize.min} max={SYSTEM_SETTINGS_LIMITS.dockIconSize.max} step={SYSTEM_SETTINGS_LIMITS.dockIconSize.step} onChange={(v) => updateSetting('dockIconSize', v)} suffix="px" accentColor={accentColor} />

              <div className={sectionCardClass}>
                <p className="text-sm font-medium text-white/90">Posizione Dock</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {SYSTEM_SETTINGS_OPTIONS.dockPosition.map((position) => (
                    <button
                      key={position}
                      onClick={() => updateSetting('dockPosition', position)}
                      className={`rounded-lg px-3 py-2 text-sm border transition ${settings.dockPosition === position ? 'text-white' : 'border-white/15 bg-white/5 hover:bg-white/10 text-white/75'}`}
                      style={settings.dockPosition === position ? { backgroundColor: `${accentColor}66`, borderColor: `${accentColor}AA` } : undefined}
                    >
                      {SYSTEM_SETTINGS_LABELS.dockPosition[position]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!normalizedQuery && activeSection === 'windows' && currentSubTab === 'behavior' && (
            <div className="space-y-3">
              <ToggleRow label="Aggancio finestre (snapping)" checked={settings.windowSnapping} onChange={(v) => updateSetting('windowSnapping', v)} accentColor={accentColor} />
              <ToggleRow label="Stage Manager" checked={settings.stageManager} onChange={(v) => updateSetting('stageManager', v)} accentColor={accentColor} />
              <ToggleRow label="Riapri app all'avvio" checked={settings.openAppsOnBoot} onChange={(v) => updateSetting('openAppsOnBoot', v)} accentColor={accentColor} />
            </div>
          )}

          {!normalizedQuery && activeSection === 'windows' && currentSubTab === 'visual' && (
            <div className="space-y-3">
              <SliderRow label="Opacità finestre" value={settings.windowOpacity} min={SYSTEM_SETTINGS_LIMITS.windowOpacity.min} max={SYSTEM_SETTINGS_LIMITS.windowOpacity.max} step={SYSTEM_SETTINGS_LIMITS.windowOpacity.step} onChange={(v) => updateSetting('windowOpacity', v)} suffix="%" accentColor={accentColor} />
            </div>
          )}

          {!normalizedQuery && activeSection === 'notifications' && currentSubTab === 'general' && (
            <div className="space-y-3">
              <ToggleRow label="Notifiche abilitate" checked={settings.notificationsEnabled} onChange={(v) => updateSetting('notificationsEnabled', v)} accentColor={accentColor} />
              <ToggleRow label="Non disturbare" checked={settings.doNotDisturb} onChange={(v) => updateSetting('doNotDisturb', v)} accentColor={accentColor} />
              <ToggleRow label="Suono notifiche" checked={settings.notificationSound} onChange={(v) => updateSetting('notificationSound', v)} accentColor={accentColor} />
              <ToggleRow label="Centro notifiche compatto" checked={settings.notificationCenterCompact} onChange={(v) => updateSetting('notificationCenterCompact', v)} accentColor={accentColor} />
              <ToggleRow label="Badge non lette in top bar" checked={settings.notificationCenterShowBadge} onChange={(v) => updateSetting('notificationCenterShowBadge', v)} accentColor={accentColor} />
              <ToggleRow label="Colori accenti notifiche" checked={settings.notificationCenterAccentColors} onChange={(v) => updateSetting('notificationCenterAccentColors', v)} accentColor={accentColor} />
              <SliderRow label="Durata notifiche" value={settings.notificationDuration} min={SYSTEM_SETTINGS_LIMITS.notificationDuration.min} max={SYSTEM_SETTINGS_LIMITS.notificationDuration.max} step={SYSTEM_SETTINGS_LIMITS.notificationDuration.step} onChange={(v) => updateSetting('notificationDuration', v)} suffix="s" accentColor={accentColor} />
              <SliderRow label="Notifiche visibili nel centro" value={settings.notificationCenterMaxItems} min={SYSTEM_SETTINGS_LIMITS.notificationCenterMaxItems.min} max={SYSTEM_SETTINGS_LIMITS.notificationCenterMaxItems.max} step={SYSTEM_SETTINGS_LIMITS.notificationCenterMaxItems.step} onChange={(v) => updateSetting('notificationCenterMaxItems', v)} accentColor={accentColor} />

              <div className={sectionCardClass}>
                <h3 className="text-sm font-semibold">Test notifiche</h3>
                <p className="text-xs text-white/60 mt-1">Invia notifiche di prova per verificare anteprima, suono, durata e non disturbare.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => sendTestNotification('info')}
                    className="px-3 py-1.5 rounded-lg text-xs border border-white/20 bg-white/10 hover:bg-white/15"
                  >
                    Test info
                  </button>
                  <button
                    onClick={() => sendTestNotification('success')}
                    className="px-3 py-1.5 rounded-lg text-xs border border-emerald-300/30 bg-emerald-500/20 hover:bg-emerald-500/30"
                  >
                    Test success
                  </button>
                  <button
                    onClick={() => sendTestNotification('warning')}
                    className="px-3 py-1.5 rounded-lg text-xs border border-amber-300/30 bg-amber-500/20 hover:bg-amber-500/30"
                  >
                    Test warning
                  </button>
                  <button
                    onClick={() => sendTestNotification('error')}
                    className="px-3 py-1.5 rounded-lg text-xs border border-rose-300/30 bg-rose-500/20 hover:bg-rose-500/30"
                  >
                    Test error
                  </button>
                </div>
                {!settings.notificationsEnabled && <p className="text-[11px] text-amber-200/90 mt-2">Le notifiche sono disattivate: il test non verrà mostrato finché non le riattivi.</p>}
                {settings.doNotDisturb && <p className="text-[11px] text-amber-200/90 mt-1">Modalità Non disturbare attiva: il test viene silenziato.</p>}
              </div>
            </div>
          )}

          {!normalizedQuery && activeSection === 'notifications' && currentSubTab === 'preview' && (
            <div className="space-y-3">
              <div className={sectionCardClass}>
                <p className="text-sm font-medium text-white/90">Anteprima notifiche</p>
                <div className="mt-2 grid sm:grid-cols-3 gap-2">
                  {SYSTEM_SETTINGS_OPTIONS.notificationsPreview.map((mode) => (
                    <button
                      key={mode}
                      onClick={() => updateSetting('notificationsPreview', mode)}
                      className={`rounded-lg px-3 py-2 text-sm border transition ${settings.notificationsPreview === mode ? 'text-white' : 'border-white/15 bg-white/5 hover:bg-white/10 text-white/75'}`}
                      style={settings.notificationsPreview === mode ? { backgroundColor: `${accentColor}66`, borderColor: `${accentColor}AA` } : undefined}
                    >
                      {SYSTEM_SETTINGS_LABELS.notificationsPreview[mode]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!normalizedQuery && activeSection === 'widgets' && currentSubTab === 'layout' && (
            <div className="space-y-3">
              <SliderRow label="Colonne griglia widget" value={settings.widgetsColumns} min={SYSTEM_SETTINGS_LIMITS.widgetsColumns.min} max={SYSTEM_SETTINGS_LIMITS.widgetsColumns.max} step={SYSTEM_SETTINGS_LIMITS.widgetsColumns.step} onChange={(v) => updateSetting('widgetsColumns', v)} accentColor={accentColor} />
              <SliderRow label="Opacità widget" value={settings.widgetsOpacity} min={SYSTEM_SETTINGS_LIMITS.widgetsOpacity.min} max={SYSTEM_SETTINGS_LIMITS.widgetsOpacity.max} step={SYSTEM_SETTINGS_LIMITS.widgetsOpacity.step} onChange={(v) => updateSetting('widgetsOpacity', v)} suffix="%" accentColor={accentColor} />
            </div>
          )}

          {!normalizedQuery && activeSection === 'widgets' && currentSubTab === 'style' && (
            <div className="space-y-3">
              <ToggleRow label="Blur sui widget" checked={settings.widgetsBlur} onChange={(v) => updateSetting('widgetsBlur', v)} accentColor={accentColor} />
              <ToggleRow label="Bordi accentati" checked={settings.widgetsAccentBorders} onChange={(v) => updateSetting('widgetsAccentBorders', v)} accentColor={accentColor} />
            </div>
          )}

          {!normalizedQuery && activeSection === 'widgets' && currentSubTab === 'clock' && (
            <div className="space-y-3">
              <ToggleRow label="Orario 24h" checked={settings.clockUse24h} onChange={(v) => updateSetting('clockUse24h', v)} accentColor={accentColor} />
              <ToggleRow label="Mostra giorno della settimana" checked={settings.clockShowWeekday} onChange={(v) => updateSetting('clockShowWeekday', v)} accentColor={accentColor} />
              <ToggleRow label="Mostra secondi" checked={settings.clockShowSeconds} onChange={(v) => updateSetting('clockShowSeconds', v)} accentColor={accentColor} />
            </div>
          )}

          {!normalizedQuery && activeSection === 'users' && currentSubTab === 'accounts' && (
            <div className="space-y-3">
              <div className={sectionCardClass}>
                <h3 className="text-sm font-semibold">Utente corrente</h3>
                <p className="text-white/80 text-sm mt-1">{currentUser?.displayName} (@{currentUser?.username}) {currentUser?.role === 'admin' ? '• admin' : ''}</p>
              </div>

              <div className={sectionCardClass}>
                <h3 className="text-sm font-semibold mb-3">Utenti disponibili</h3>
                <div className="space-y-2">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
                      <span>{user.displayName}</span>
                      <span className="text-white/60">@{user.username}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!normalizedQuery && activeSection === 'users' && currentSubTab === 'create' && isAdmin && (
            <div className="space-y-3">
              <div className={sectionCardClass}>
                <h3 className="text-sm font-semibold mb-3">Crea nuovo utente</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <input value={newDisplayName} onChange={(e) => { setNewDisplayName(e.target.value); setUserCreateMessage(null) }} placeholder="Nome visualizzato" className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30" />
                  <input value={newUsername} onChange={(e) => { setNewUsername(e.target.value); setUserCreateMessage(null) }} placeholder="Username" className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30" />
                  <input type="password" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setUserCreateMessage(null) }} placeholder="Password" className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30" />
                  <select value={newRole} onChange={(e) => { setNewRole(e.target.value as 'admin' | 'user'); setUserCreateMessage(null) }} className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30">
                    <option value="user" className="bg-slate-900">Utente standard</option>
                    <option value="admin" className="bg-slate-900">Admin</option>
                  </select>
                </div>

                <button
                  onClick={handleCreateUser}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Crea account
                </button>

                {userCreateMessage && <p className="mt-2 text-xs text-white/75">{userCreateMessage}</p>}
              </div>
            </div>
          )}

          {!normalizedQuery && activeSection === 'users' && currentSubTab === 'create' && !isAdmin && (
            <div className={sectionCardClass}>
              <h3 className="text-sm font-semibold">Permessi insufficienti</h3>
              <p className="text-xs text-white/60 mt-1">Solo un account admin può creare nuovi utenti.</p>
            </div>
          )}

          {!normalizedQuery && activeSection === 'system' && currentSubTab === 'regional' && (
            <div className="space-y-3">
              <div className={sectionCardClass}>
                <h3 className="text-sm font-semibold">Lingua e regione</h3>
                <label className="block mt-2 text-sm text-white/80">
                  <select
                    value={settings.language}
                    onChange={(e) => updateSetting('language', e.target.value as DesktopSettings['language'])}
                    className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30"
                  >
                    {SYSTEM_SETTINGS_OPTIONS.language.map((lang) => (
                      <option key={lang} value={lang} className="bg-slate-900">{SYSTEM_SETTINGS_LABELS.language[lang]}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}

          {!normalizedQuery && activeSection === 'system' && currentSubTab === 'shortcuts' && (
            <div className="space-y-3">
              <ToggleRow label="Abilita Spotlight" checked={settings.spotlightEnabled} onChange={(v) => updateSetting('spotlightEnabled', v)} accentColor={accentColor} />
              <div className={sectionCardClass}>
                <h3 className="text-sm font-semibold mb-2">Scorciatoia Spotlight</h3>
                <select
                  value={settings.spotlightShortcut}
                  onChange={(e) => updateSetting('spotlightShortcut', e.target.value as DesktopSettings['spotlightShortcut'])}
                  className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30"
                >
                  {SYSTEM_SETTINGS_OPTIONS.spotlightShortcut.map((shortcut) => (
                    <option key={shortcut} value={shortcut} className="bg-slate-900">{SYSTEM_SETTINGS_LABELS.spotlightShortcut[shortcut]}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {!normalizedQuery && activeSection === 'system' && currentSubTab === 'permissions' && (
            <div className="space-y-3">
              <div className={sectionCardClass}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Permission System</h3>
                    <p className="text-xs text-white/60 mt-1">Controlla i permessi runtime per ogni applicazione.</p>
                  </div>
                  <button
                    onClick={resetPermissions}
                    className="rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs"
                  >
                    Ripristina policy
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {permissionTargets.map((item) => (
                  <div key={item.id} className={sectionCardClass}>
                    <button
                      onClick={() => setExpandedPermissionApp((prev) => (prev === item.id ? null : item.id))}
                      className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:scale-[1.02] transition-transform"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg border border-white/15 bg-white/[0.06] inline-flex items-center justify-center overflow-hidden shrink-0">
                          {typeof item.definition.icon === 'string' ? (
                            <img
                              src={`/apps/${item.definition.icon}`}
                              alt={item.definition.name}
                              className="h-7 w-7 rounded-md object-cover"
                              onError={(event) => {
                                event.currentTarget.src = '/apps/default-icon.svg'
                              }}
                            />
                          ) : (
                            <span className="text-white/80 text-xs font-semibold">{item.definition.name.slice(0, 1).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="text-sm font-semibold text-white/90 truncate">{item.definition.name}</p>
                          <p className="text-[11px] text-white/55 truncate">{item.id}{item.isCore ? ' · core' : ''}</p>
                        </div>
                      </div>
                      <div className="text-white/60 shrink-0">
                        {expandedPermissionApp === item.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </button>

                    {expandedPermissionApp === item.id ? (
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3 animate-fadeIn">
                        {permissionKeys.map((permission) => {
                          const current = getPermission(item.id, permission)
                          const lockDeny = isPermissionLocked(item.id, permission, 'deny')
                          const isAllow = current === 'allow'
                          return (
                            <div key={`${item.id}:${permission}`} className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <p className="text-[11px] text-white/75 inline-flex items-center gap-1.5">
                                  <span className="text-white/70">{permissionIcons[permission]}</span>
                                  {permissionLabels[permission]}
                                </p>
                                <span
                                  className={`text-[10px] inline-flex items-center gap-1 rounded-full px-2 py-0.5 border ${isAllow ? 'border-emerald-300/30 bg-emerald-500/20 text-emerald-100' : 'border-rose-300/30 bg-rose-500/20 text-rose-100'}`}
                                >
                                  {isAllow ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                                  {isAllow ? 'Consentito' : 'Negato'}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  onClick={() => setPermission(item.id, permission, 'allow')}
                                  className={`rounded-md border px-2 py-1.5 text-xs transition ${isAllow ? 'border-emerald-300/40 bg-emerald-500/25 text-emerald-100' : 'border-white/10 bg-white/5 hover:bg-white/10 text-white/75'}`}
                                >
                                  Allow
                                </button>
                                <button
                                  onClick={() => setPermission(item.id, permission, 'deny')}
                                  disabled={lockDeny}
                                  className={`rounded-md border px-2 py-1.5 text-xs transition ${!isAllow ? 'border-rose-300/40 bg-rose-500/25 text-rose-100' : 'border-white/10 bg-white/5 hover:bg-white/10 text-white/75'} disabled:opacity-40 disabled:cursor-not-allowed`}
                                >
                                  Deny
                                </button>
                              </div>
                              {lockDeny ? <p className="mt-1 text-[10px] text-white/45">Core app: launch non disattivabile.</p> : null}
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!normalizedQuery && activeSection === 'system' && currentSubTab === 'maintenance' && (
            <div className="space-y-3">
              <div className={sectionCardClass}>
                <h3 className="text-sm font-semibold">Manutenzione</h3>
                <p className="text-xs text-white/60 mt-1 mb-3">Ripristina tutte le preferenze personalizzate ai valori iniziali.</p>
                <button
                  onClick={resetSettings}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-500/80 hover:bg-red-500 px-4 py-2 text-sm font-medium transition"
                >
                  Ripristina impostazioni
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
