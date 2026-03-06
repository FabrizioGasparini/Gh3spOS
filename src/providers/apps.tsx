import { createContext, useContext, useEffect, useMemo } from 'react'
import type { AppDefinition } from '@/types'
import { apps as appDefinitions } from '@/apps/definitions'
import { usePersistentStore } from '@/providers/persistent-store'

type AppRuntime = 'embedded' | 'container-service'

type AppContainerProfile = {
  runtime: AppRuntime
}

type AppPackageProfile = {
  name: string
  version: string
  sizeMb: number
}

export type AppCatalogItem = {
  id: string
  definition: AppDefinition
  description: string
  category: 'system' | 'productivity' | 'developer' | 'media'
  container: AppContainerProfile
  package: AppPackageProfile
  screenshots?: string[]
}

type AppsContextType = {
  apps: Map<string, AppDefinition>
  catalog: AppCatalogItem[]
  isInstalled: (id: string) => boolean
  isEnabled: (id: string) => boolean
  isPinned: (id: string) => boolean
  installApp: (id: string) => void
  uninstallApp: (id: string) => void
  setAppEnabled: (id: string, value: boolean) => void
  setPinned: (id: string, value: boolean) => void
}

const DEFAULT_INSTALLED = [...appDefinitions.keys()]
const CORE_APPS = ['settings', 'file-explorer', 'app-store', 'terminal'] as const

const APP_CATALOG: AppCatalogItem[] = [
  {
    id: 'settings',
    definition: appDefinitions.get('settings')!,
    description: 'Preferenze di sistema e configurazioni desktop',
    category: 'system',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/settings', version: '1.0.0', sizeMb: 36 },
    screenshots: ['/apps/dock-settings.png', '/wallpapers/glass.png'],
  },
  {
    id: 'notepad',
    definition: appDefinitions.get('notepad')!,
    description: 'Editor testo semplice e veloce',
    category: 'productivity',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/notepad', version: '1.0.0', sizeMb: 388 },
    screenshots: ['/apps/dock-notepad.png', '/wallpapers/default.jpg'],
  },
  {
    id: 'file-explorer',
    definition: appDefinitions.get('file-explorer')!,
    description: 'Esplora file locali e cloud remoto',
    category: 'system',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/file-explorer', version: '1.0.0', sizeMb: 612 },
    screenshots: ['/apps/dock-files.png', '/wallpapers/glass-2.png'],
  },
  {
    id: 'widget-store',
    definition: appDefinitions.get('widget-store')!,
    description: 'Installa e gestisci widget desktop',
    category: 'productivity',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/widget-store', version: '1.0.0', sizeMb: 24 },
    screenshots: ['/apps/dock-store.png', '/wallpapers/default.jpg'],
  },
  {
    id: 'app-store',
    definition: appDefinitions.get('app-store')!,
    description: 'Gestione app installate, abilitate e pin dock',
    category: 'system',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/app-store', version: '1.0.0', sizeMb: 44 },
    screenshots: ['/apps/dock-store.png', '/wallpapers/glass.png'],
  },
  {
    id: 'terminal',
    definition: appDefinitions.get('terminal')!,
    description: 'Terminale sviluppatore con comandi interni',
    category: 'developer',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/terminal', version: '1.0.0', sizeMb: 428 },
    screenshots: ['/apps/dock-terminal.png', '/wallpapers/default.jpg'],
  },
  {
    id: 'browser',
    definition: appDefinitions.get('browser')!,
    description: 'Browser remoto sicuro basato su Selenium e noVNC',
    category: 'media',
    container: { runtime: 'container-service' },
    package: { name: 'gh3spos/browser', version: '1.0.0', sizeMb: 934 },
    screenshots: ['/apps/task-manager.png', '/wallpapers/glass-2.png'],
  },
  {
    id: 'task-manager',
    definition: appDefinitions.get('task-manager')!,
    description: 'Monitor processi e widget attivi',
    category: 'system',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/task-manager', version: '1.0.0', sizeMb: 28 },
    screenshots: ['/apps/task-manager.png', '/wallpapers/default.jpg'],
  },
  {
    id: 'test-app',
    definition: appDefinitions.get('test-app')!,
    description: 'App sandbox per test funzionali',
    category: 'developer',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/test-app', version: '1.0.0', sizeMb: 15 },
    screenshots: ['/apps/default-icon.svg', '/wallpapers/glass.png'],
  },
  {
    id: 'gh3preview',
    definition: appDefinitions.get('gh3preview')!,
    description: 'Preview rapida per contenuti file',
    category: 'media',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/gh3preview', version: '1.0.0', sizeMb: 76 },
    screenshots: ['/apps/preview.png', '/wallpapers/default.jpg'],
  },
]

const AppsContext = createContext<AppsContextType | null>(null)

export const AppsProvider = ({ children }: { children: React.ReactNode }) => {
  const [installedIds, setInstalledIds] = usePersistentStore<string[]>('apps:installed', DEFAULT_INSTALLED)
  const [enabledMap, setEnabledMap] = usePersistentStore<Record<string, boolean>>('apps:enabled', {})
  const [pinnedMap, setPinnedMap] = usePersistentStore<Record<string, boolean>>('apps:pinned', {})

  useEffect(() => {
    const missingCore = CORE_APPS.filter((id) => !installedIds.includes(id))
    if (missingCore.length === 0) return
    setInstalledIds((prev) => [...new Set([...prev, ...missingCore])])
  }, [installedIds, setInstalledIds])

  useEffect(() => {
    const needsEnable = CORE_APPS.some((id) => enabledMap[id] === false)
    if (!needsEnable) return
    setEnabledMap((prev) => {
      const next = { ...prev }
      for (const id of CORE_APPS) {
        if (next[id] === false) next[id] = true
      }
      return next
    })
  }, [enabledMap, setEnabledMap])

  const isInstalled = (id: string) => installedIds.includes(id)
  const isEnabled = (id: string) => enabledMap[id] ?? true
  const isPinned = (id: string) => pinnedMap[id] ?? (appDefinitions.get(id)?.isPinned ?? false)

  const installApp = (id: string) => {
    if (isInstalled(id)) return
    setInstalledIds(prev => [...prev, id])
  }

  const uninstallApp = (id: string) => {
    if (id === 'settings' || id === 'file-explorer' || id === 'app-store') return
    setInstalledIds(prev => prev.filter(appId => appId !== id))
  }

  const setAppEnabled = (id: string, value: boolean) => {
    if (id === 'settings' || id === 'file-explorer' || id === 'app-store') return
    setEnabledMap(prev => ({ ...prev, [id]: value }))
  }

  const setPinned = (id: string, value: boolean) => {
    setPinnedMap(prev => ({ ...prev, [id]: value }))
  }

  const apps = useMemo(() => {
    const next = new Map<string, AppDefinition>()
    for (const [id, definition] of appDefinitions.entries()) {
      const installed = installedIds.includes(id)
      const enabled = enabledMap[id] ?? true
      const pinned = pinnedMap[id] ?? (appDefinitions.get(id)?.isPinned ?? false)
      if (!installed || !enabled) continue
      next.set(id, { ...definition, isPinned: pinned })
    }
    return next
  }, [installedIds, enabledMap, pinnedMap])

  const value: AppsContextType = {
    apps,
    catalog: APP_CATALOG,
    isInstalled,
    isEnabled,
    isPinned,
    installApp,
    uninstallApp,
    setAppEnabled,
    setPinned,
  }

  return <AppsContext.Provider value={value}>{children}</AppsContext.Provider>
}

export const useApps = () => {
  const ctx = useContext(AppsContext)
  if (!ctx) throw new Error('useApps must be used within AppsProvider')
  return ctx
}
