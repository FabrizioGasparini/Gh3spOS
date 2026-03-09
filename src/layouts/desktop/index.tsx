import {Dock} from "@/components/dock/index"
import { useWallpaper } from "@/providers/wallpaper";
import { WindowManager } from "@/modules/window/window-manager"
import Wallpaper from "@/components/wallpaper/wallpaper"
import { WidgetLayer } from "@/modules/widgets/widget-layer";
import Spotlight from "@/components/spotlight";
import { MenuBar } from "@/components/menu-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePersistentStore } from "@/providers/persistent-store";
import { DEFAULT_DESKTOP_SETTINGS, resolveDesktopSettings, type DesktopSettings } from "@/config/system-settings";
import { AnimatePresence, motion } from 'framer-motion';
import { useSpotlight } from "@/providers/spotlight";
import { useApps } from "@/providers/apps";
import { useWindowManager } from "@/providers/window-manager";
import { useAuth } from "@/providers/auth";

const Desktop = () => {
  const { wallpaper } = useWallpaper();
  const { open: openSpotlight } = useSpotlight()
  const { apps, canUsePermission } = useApps()
  const { openWindow } = useWindowManager()
  const { logout } = useAuth()
  const [storedSettings, setStoredSettings] = usePersistentStore<DesktopSettings>('gh3sp:settings', DEFAULT_DESKTOP_SETTINGS)
  const [, setActiveSection] = usePersistentStore<'appearance' | 'desktop' | 'windows' | 'notifications' | 'widgets' | 'users' | 'system'>('gh3sp:settings:active-section', 'appearance')
  const [, setActiveSubTabs] = usePersistentStore<Record<'appearance' | 'desktop' | 'windows' | 'notifications' | 'widgets' | 'users' | 'system', string>>('gh3sp:settings:subtabs', {
    appearance: 'theme',
    desktop: 'wallpaper',
    windows: 'behavior',
    notifications: 'general',
    widgets: 'layout',
    users: 'accounts',
    system: 'regional',
  })
  const settings = useMemo(() => resolveDesktopSettings(storedSettings), [storedSettings])
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const shouldAnimate = !settings.reduceMotion
  const layerTransition = shouldAnimate
    ? { duration: 0.5, ease: 'easeOut' as const }
    : { duration: 0 }

  useEffect(() => {
    const close = () => setContextMenu(null)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('click', close)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const openApp = (appId: string) => {
    if (!canUsePermission(appId, 'launch')) return
    const app = apps.get(appId)
    if (!app) return
    openWindow(app, appId)
  }

  const openDesktopSettings = () => {
    setActiveSection('desktop')
    setActiveSubTabs((prev) => ({ ...prev, desktop: 'wallpaper' }))
    openApp('settings')
  }

  const toggleDoNotDisturb = () => {
    setStoredSettings((prev) => ({ ...resolveDesktopSettings(prev), doNotDisturb: !resolveDesktopSettings(prev).doNotDisturb }))
  }

    return (
      <div
        className={`w-screen h-screen relative overflow-hidden bg-cover bg-transparent ${settings.reduceMotion ? 'reduce-motion' : ''} ${settings.reduceTransparency ? 'reduce-transparency' : ''}`}
        onContextMenu={(event) => {
          if (event.target !== event.currentTarget) return
          event.preventDefault()
          setContextMenu({ x: event.clientX, y: event.clientY })
        }}
      >
        <motion.div
          initial={shouldAnimate ? { scale: 1.04, opacity: 0.65 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={layerTransition}
          className="absolute inset-0"
        >
          <Wallpaper image={wallpaper} blur={settings.wallpaperBlur} />
        </motion.div>
        <motion.div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/45"
          style={{ opacity: settings.wallpaperOverlay / 100 }}
          animate={shouldAnimate ? { opacity: [settings.wallpaperOverlay / 100, (settings.wallpaperOverlay + 6) / 100, settings.wallpaperOverlay / 100] } : undefined}
          transition={shouldAnimate ? { duration: 9, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' } : undefined}
        />
        <motion.div
          initial={shouldAnimate ? { opacity: 0, y: -14 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...layerTransition, delay: shouldAnimate ? 0.06 : 0 }}
        >
          <MenuBar />
        </motion.div>
        <motion.div
          className="absolute inset-0 z-20"
          initial={shouldAnimate ? { opacity: 0, y: 16, scale: 0.99 } : false}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...layerTransition, delay: shouldAnimate ? 0.14 : 0 }}
        >
          <WidgetLayer />
        </motion.div>
        <motion.div
          className="absolute inset-0 z-30 pointer-events-none"
          initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...layerTransition, delay: shouldAnimate ? 0.22 : 0 }}
        >
          <WindowManager />
        </motion.div>
        <motion.div
          initial={shouldAnimate ? { opacity: 0, y: 16 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...layerTransition, delay: shouldAnimate ? 0.3 : 0 }}
        >
          <Dock />
        </motion.div>
        <motion.div
          initial={shouldAnimate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ ...layerTransition, delay: shouldAnimate ? 0.12 : 0 }}
        >
          <Spotlight />
        </motion.div>

        <AnimatePresence>
          {contextMenu && (
            <motion.div
              className="fixed inset-0 z-[130]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setContextMenu(null)}
            >
              <motion.div
                ref={contextMenuRef}
                className="absolute w-60 rounded-2xl border border-white/20 bg-black/78 backdrop-blur-2xl p-2 shadow-2xl"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                onClick={(event) => event.stopPropagation()}
              >
                <button onClick={() => { openSpotlight(); setContextMenu(null) }} className="w-full text-left rounded-lg px-3 py-2 text-sm text-white hover:bg-white/10">Apri Spotlight</button>
                <button onClick={() => { openApp('terminal'); setContextMenu(null) }} className="w-full text-left rounded-lg px-3 py-2 text-sm text-white hover:bg-white/10">Apri Terminale</button>
                <button onClick={() => { openDesktopSettings(); setContextMenu(null) }} className="w-full text-left rounded-lg px-3 py-2 text-sm text-white hover:bg-white/10">Impostazioni Desktop</button>
                <button onClick={() => { toggleDoNotDisturb(); setContextMenu(null) }} className="w-full text-left rounded-lg px-3 py-2 text-sm text-white hover:bg-white/10">{settings.doNotDisturb ? 'Disattiva Non disturbare' : 'Attiva Non disturbare'}</button>
                <div className="my-1 h-px bg-white/12" />
                <button onClick={() => { logout(); setContextMenu(null) }} className="w-full text-left rounded-lg px-3 py-2 text-sm text-red-200 hover:bg-red-500/20">Blocca sessione</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
};
  
export {Desktop};
  