import { useEffect, useMemo } from 'react'
import { ACCENT_COLOR_VALUES, DEFAULT_DESKTOP_SETTINGS, resolveDesktopSettings, type DesktopSettings } from '@/config/system-settings'
import { usePersistentStore } from '@/providers/persistent-store'

const parseHexColor = (hex: string) => {
  const clean = hex.replace('#', '')
  const normalized = clean.length === 3
    ? clean.split('').map((segment) => `${segment}${segment}`).join('')
    : clean
  const value = Number.parseInt(normalized, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return { r, g, b }
}

const isNightTime = (date: Date) => {
  const hour = date.getHours()
  return hour >= 19 || hour < 7
}

const resolveThemeMode = (settings: DesktopSettings) => {
  if (settings.themeMode !== 'auto') return settings.themeMode

  if (settings.themeEngineTimeAwareAuto) {
    return isNightTime(new Date()) ? 'dark' : 'light'
  }

  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'light'
}

export const ThemeEngineProvider = ({ children }: { children: React.ReactNode }) => {
  const [storedSettings] = usePersistentStore<DesktopSettings>('gh3sp:settings', DEFAULT_DESKTOP_SETTINGS)
  const settings = useMemo(() => resolveDesktopSettings(storedSettings), [storedSettings])

  useEffect(() => {
    const resolvedMode = resolveThemeMode(settings)
    const accent = ACCENT_COLOR_VALUES[settings.accentColor]
    const { r, g, b } = parseHexColor(accent)
    const dynamicStrength = settings.themeEngineDynamicAccent
      ? (isNightTime(new Date()) ? 0.26 : 0.2)
      : 0.16

    document.body.classList.toggle('theme-light', resolvedMode === 'light')
    document.body.classList.toggle('theme-dark', resolvedMode === 'dark')
    document.body.dataset.theme = resolvedMode

    const root = document.documentElement
    root.style.setProperty('--gh3sp-accent', accent)
    root.style.setProperty('--gh3sp-accent-rgb', `${r} ${g} ${b}`)
    root.style.setProperty('--gh3sp-accent-soft', `rgba(${r}, ${g}, ${b}, ${dynamicStrength})`)
    root.style.setProperty('--gh3sp-surface-opacity', settings.reduceTransparency ? '0.9' : '0.72')
    root.style.setProperty('--gh3sp-border-opacity', settings.reduceTransparency ? '0.3' : '0.2')
  }, [settings])

  return <>{children}</>
}
