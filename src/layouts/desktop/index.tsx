import {Dock} from "@/components/dock/index"
import { useWallpaper } from "@/providers/wallpaper";
import { WindowManager } from "@/modules/window/window-manager"
import Wallpaper from "@/components/wallpaper/wallpaper"
import { WidgetLayer } from "@/modules/widgets/widget-layer";
import Spotlight from "@/components/spotlight";
import { MenuBar } from "@/components/menu-bar";
import { useEffect, useMemo } from "react";
import { usePersistentStore } from "@/providers/persistent-store";
import { DEFAULT_DESKTOP_SETTINGS, resolveDesktopSettings, type DesktopSettings } from "@/config/system-settings";

const ACCENT_COLORS: Record<DesktopSettings['accentColor'], string> = {
  blue: '#3b82f6',
  purple: '#8b5cf6',
  green: '#10b981',
  orange: '#f97316',
  pink: '#ec4899',
}

const Desktop = () => {
  const { wallpaper } = useWallpaper();
  const [storedSettings] = usePersistentStore<DesktopSettings>('gh3sp:settings', DEFAULT_DESKTOP_SETTINGS)
  const settings = useMemo(() => resolveDesktopSettings(storedSettings), [storedSettings])

  useEffect(() => {
    const isAutoDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    const resolvedTheme = settings.themeMode === 'auto' ? (isAutoDark ? 'dark' : 'light') : settings.themeMode
    document.body.classList.toggle('theme-light', resolvedTheme === 'light')
    document.body.classList.toggle('theme-dark', resolvedTheme === 'dark')
  }, [settings.themeMode])

    return (
      <div
        className={`w-screen h-screen relative overflow-hidden bg-cover bg-transparent ${settings.reduceMotion ? 'reduce-motion' : ''} ${settings.reduceTransparency ? 'reduce-transparency' : ''}`}
        style={{ ['--gh3sp-accent' as string]: ACCENT_COLORS[settings.accentColor] }}
      >
        <Wallpaper image={wallpaper} blur={settings.wallpaperBlur} />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/45"
          style={{ opacity: settings.wallpaperOverlay / 100 }}
        />
        <MenuBar />
        <WindowManager />
        <WidgetLayer />
        <Dock />
        <Spotlight />
      </div>
    );
};
  
export {Desktop};
  