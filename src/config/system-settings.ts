export type SystemSettings = {
	themeMode: 'auto' | 'dark' | 'light'
	accentColor: 'blue' | 'purple' | 'green' | 'orange' | 'pink'
	reduceTransparency: boolean
	reduceMotion: boolean
	menuBarShowFocusedApp: boolean
	menuBarCompact: boolean
	spotlightEnabled: boolean
	spotlightShortcut: 'cmd-space' | 'alt-space'
	wallpaper: string
	wallpaperOverlay: number
	wallpaperBlur: number
	dockMagnification: boolean
	dockAutoHide: boolean
	dockIconSize: number
	dockPosition: 'bottom' | 'left' | 'right'
	windowSnapping: boolean
	windowOpacity: number
	openAppsOnBoot: boolean
	stageManager: boolean
	notificationsEnabled: boolean
	doNotDisturb: boolean
	notificationsPreview: 'always' | 'locked' | 'never'
	notificationSound: boolean
	notificationDuration: number
	notificationCenterCompact: boolean
	notificationCenterShowBadge: boolean
	notificationCenterAccentColors: boolean
	notificationCenterMaxItems: number
	widgetsBlur: boolean
	widgetsColumns: number
	widgetsOpacity: number
	widgetsAccentBorders: boolean
	clockUse24h: boolean
	clockShowWeekday: boolean
	clockShowSeconds: boolean
	language: 'it-IT' | 'en-US'
}

export const SYSTEM_SETTINGS_DEFAULTS: SystemSettings = {
	themeMode: 'dark',
	accentColor: 'blue',
	reduceTransparency: false,
	reduceMotion: false,
	menuBarShowFocusedApp: true,
	menuBarCompact: false,
	spotlightEnabled: true,
	spotlightShortcut: 'cmd-space',
	wallpaper: '/wallpapers/default.jpg',
	wallpaperOverlay: 45,
	wallpaperBlur: 0,
	dockMagnification: true,
	dockAutoHide: false,
	dockIconSize: 40,
	dockPosition: 'bottom',
	windowSnapping: true,
	windowOpacity: 100,
	openAppsOnBoot: true,
	stageManager: false,
	notificationsEnabled: true,
	doNotDisturb: false,
	notificationsPreview: 'always',
	notificationSound: true,
	notificationDuration: 4,
	notificationCenterCompact: true,
	notificationCenterShowBadge: true,
	notificationCenterAccentColors: true,
	notificationCenterMaxItems: 24,
	widgetsBlur: true,
	widgetsColumns: 6,
	widgetsOpacity: 85,
	widgetsAccentBorders: true,
	clockUse24h: true,
	clockShowWeekday: true,
	clockShowSeconds: false,
	language: 'it-IT',
}

export const SYSTEM_SETTINGS_LIMITS = {
	wallpaperOverlay: { min: 0, max: 70, step: 1 },
	wallpaperBlur: { min: 0, max: 12, step: 1 },
	dockIconSize: { min: 30, max: 72, step: 1 },
	windowOpacity: { min: 70, max: 100, step: 1 },
	notificationDuration: { min: 2, max: 10, step: 1 },
	notificationCenterMaxItems: { min: 8, max: 60, step: 1 },
	widgetsColumns: { min: 4, max: 8, step: 1 },
	widgetsOpacity: { min: 40, max: 100, step: 1 },
} as const

export const SYSTEM_SETTINGS_OPTIONS = {
	themeMode: ['auto', 'dark', 'light'] as const,
	accentColor: ['blue', 'purple', 'green', 'orange', 'pink'] as const,
	dockPosition: ['left', 'bottom', 'right'] as const,
	notificationsPreview: ['always', 'locked', 'never'] as const,
	language: ['it-IT', 'en-US'] as const,
	spotlightShortcut: ['cmd-space', 'alt-space'] as const,
} as const

export const SYSTEM_SETTINGS_LABELS = {
	themeMode: {
		auto: 'Auto',
		dark: 'Scuro',
		light: 'Chiaro',
	},
	accentColor: {
		blue: 'Blu',
		purple: 'Viola',
		green: 'Verde',
		orange: 'Arancione',
		pink: 'Rosa',
	},
	dockPosition: {
		left: 'Sinistra',
		bottom: 'Basso',
		right: 'Destra',
	},
	notificationsPreview: {
		always: 'Sempre',
		locked: 'Solo sbloccato',
		never: 'Mai',
	},
	language: {
		'it-IT': 'Italiano (Italia)',
		'en-US': 'English (US)',
	},
	spotlightShortcut: {
		'cmd-space': 'Cmd/Ctrl + Space',
		'alt-space': 'Alt + Space',
	},
} as const

export const ACCENT_COLOR_VALUES: Record<SystemSettings['accentColor'], string> = {
	blue: '#3b82f6',
	purple: '#8b5cf6',
	green: '#10b981',
	orange: '#f97316',
	pink: '#ec4899',
}

export const WALLPAPER_CHOICES = [
	{ id: '/wallpapers/default.jpg', label: 'Default' },
	{ id: '/wallpapers/glass.png', label: 'Glass Aurora' },
	{ id: '/wallpapers/glass-2.png', label: 'Glass Night' },
] as const

export const resolveSystemSettings = (partial: Partial<SystemSettings> | null | undefined): SystemSettings => ({
	...SYSTEM_SETTINGS_DEFAULTS,
	...(partial ?? {}),
	wallpaperOverlay: Math.min(SYSTEM_SETTINGS_LIMITS.wallpaperOverlay.max, Math.max(SYSTEM_SETTINGS_LIMITS.wallpaperOverlay.min, Number(partial?.wallpaperOverlay ?? SYSTEM_SETTINGS_DEFAULTS.wallpaperOverlay))),
	wallpaperBlur: Math.min(SYSTEM_SETTINGS_LIMITS.wallpaperBlur.max, Math.max(SYSTEM_SETTINGS_LIMITS.wallpaperBlur.min, Number(partial?.wallpaperBlur ?? SYSTEM_SETTINGS_DEFAULTS.wallpaperBlur))),
	dockIconSize: Math.min(SYSTEM_SETTINGS_LIMITS.dockIconSize.max, Math.max(SYSTEM_SETTINGS_LIMITS.dockIconSize.min, Number(partial?.dockIconSize ?? SYSTEM_SETTINGS_DEFAULTS.dockIconSize))),
	windowOpacity: Math.min(SYSTEM_SETTINGS_LIMITS.windowOpacity.max, Math.max(SYSTEM_SETTINGS_LIMITS.windowOpacity.min, Number(partial?.windowOpacity ?? SYSTEM_SETTINGS_DEFAULTS.windowOpacity))),
	notificationDuration: Math.min(SYSTEM_SETTINGS_LIMITS.notificationDuration.max, Math.max(SYSTEM_SETTINGS_LIMITS.notificationDuration.min, Number(partial?.notificationDuration ?? SYSTEM_SETTINGS_DEFAULTS.notificationDuration))),
	notificationCenterMaxItems: Math.min(SYSTEM_SETTINGS_LIMITS.notificationCenterMaxItems.max, Math.max(SYSTEM_SETTINGS_LIMITS.notificationCenterMaxItems.min, Number(partial?.notificationCenterMaxItems ?? SYSTEM_SETTINGS_DEFAULTS.notificationCenterMaxItems))),
	widgetsColumns: Math.min(SYSTEM_SETTINGS_LIMITS.widgetsColumns.max, Math.max(SYSTEM_SETTINGS_LIMITS.widgetsColumns.min, Number(partial?.widgetsColumns ?? SYSTEM_SETTINGS_DEFAULTS.widgetsColumns))),
	widgetsOpacity: Math.min(SYSTEM_SETTINGS_LIMITS.widgetsOpacity.max, Math.max(SYSTEM_SETTINGS_LIMITS.widgetsOpacity.min, Number(partial?.widgetsOpacity ?? SYSTEM_SETTINGS_DEFAULTS.widgetsOpacity))),
})

export type DesktopSettings = SystemSettings
export const DEFAULT_DESKTOP_SETTINGS = SYSTEM_SETTINGS_DEFAULTS
export const resolveDesktopSettings = resolveSystemSettings

export const WALLPAPER_OPTIONS = [
	...WALLPAPER_CHOICES.map((item) => item.id),
]
