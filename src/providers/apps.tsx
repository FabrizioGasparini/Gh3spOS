import { createContext, useContext, useEffect, useMemo } from 'react'
import type { AppDefinition } from '@/types'
import { apps as appDefinitions } from '@/apps/definitions'
import { usePersistentStore } from '@/providers/persistent-store'

export type AppPermissionKey = 'launch' | 'filesystem' | 'network' | 'ssh' | 'notifications'
export type AppPermissionState = 'allow' | 'deny'
export type AppPermissionMap = Record<string, Partial<Record<AppPermissionKey, AppPermissionState>>>

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
  defaultPermissions?: Partial<Record<AppPermissionKey, AppPermissionState>>
}

export type AppPermissionTarget = {
  id: string
  definition: AppDefinition
  defaultPermissions?: Partial<Record<AppPermissionKey, AppPermissionState>>
  isCore: boolean
  isProtected: boolean
}

type AppsContextType = {
  apps: Map<string, AppDefinition>
  catalog: AppCatalogItem[]
  permissionTargets: AppPermissionTarget[]
  permissions: AppPermissionMap
  permissionKeys: AppPermissionKey[]
  isInstalled: (id: string) => boolean
  isEnabled: (id: string) => boolean
  isPinned: (id: string) => boolean
  canLaunchApp: (id: string) => boolean
  isPermissionLocked: (id: string, permission: AppPermissionKey, value: AppPermissionState) => boolean
  getPermission: (id: string, permission: AppPermissionKey) => AppPermissionState
  canUsePermission: (id: string, permission: AppPermissionKey) => boolean
  setPermission: (id: string, permission: AppPermissionKey, value: AppPermissionState) => void
  resetPermissions: () => void
  installApp: (id: string) => void
  uninstallApp: (id: string) => void
  setAppEnabled: (id: string, value: boolean) => void
  setPinned: (id: string, value: boolean) => void
}

const DEFAULT_INSTALLED = [...appDefinitions.entries()]
  .filter(([, definition]) => !definition.ghost)
  .map(([id]) => id)
const CORE_APPS = ['settings', 'file-explorer', 'app-store', 'widget-store', 'terminal', 'global-file-picker'] as const
const PROTECTED_APPS = [...CORE_APPS] as const
const PERMISSION_KEYS: AppPermissionKey[] = ['launch', 'filesystem', 'network', 'ssh', 'notifications']

const BASE_PERMISSION_PROFILE: Record<AppPermissionKey, AppPermissionState> = {
  launch: 'allow',
  filesystem: 'allow',
  network: 'deny',
  ssh: 'deny',
  notifications: 'allow',
}

const MIGRATION_ID = 'apps:migrations:v2-gh3connect-installed'
const MIGRATION_EMAIL_ID = 'apps:migrations:v3-mail-client-installed'
const PERMISSION_HIDDEN_APPS = ['test-app']
const INTERNAL_LAUNCHABLE_GHOST_APPS = ['global-file-picker']

const APP_CATALOG: AppCatalogItem[] = [
  {
    id: 'settings',
    definition: appDefinitions.get('settings')!,
    description: 'Configurazione sistema, policy e personalizzazione desktop',
    category: 'system',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/settings', version: '1.0.0', sizeMb: 42 },
    screenshots: ['/apps/dock-settings.png', '/wallpapers/default.jpg'],
    defaultPermissions: { launch: 'allow', filesystem: 'allow', network: 'allow', ssh: 'deny', notifications: 'allow' },
  },
  {
    id: 'file-explorer',
    definition: appDefinitions.get('file-explorer')!,
    description: 'Gestore file locale con navigazione cartelle',
    category: 'system',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/file-explorer', version: '1.0.0', sizeMb: 56 },
    screenshots: ['/apps/dock-files.png', '/wallpapers/default.jpg'],
    defaultPermissions: { launch: 'allow', filesystem: 'allow', network: 'allow', ssh: 'deny', notifications: 'allow' },
  },
  {
    id: 'app-store',
    definition: appDefinitions.get('app-store')!,
    description: 'Catalogo applicazioni, installazione e gestione',
    category: 'system',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/app-store', version: '1.0.0', sizeMb: 38 },
    screenshots: ['/apps/dock-store.png', '/wallpapers/default.jpg'],
    defaultPermissions: { launch: 'allow', filesystem: 'allow', network: 'allow', ssh: 'deny', notifications: 'allow' },
  },
  {
    id: 'terminal',
    definition: appDefinitions.get('terminal')!,
    description: 'Terminale interattivo con comandi locali e connessioni SSH',
    category: 'developer',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/terminal', version: '1.0.0', sizeMb: 70 },
    screenshots: ['/apps/dock-terminal.png', '/wallpapers/glass-2.png'],
    defaultPermissions: { launch: 'allow', filesystem: 'allow', network: 'allow', ssh: 'allow', notifications: 'allow' },
  },
  {
    id: 'notepad',
    definition: appDefinitions.get('notepad')!,
    description: 'Editor testo semplice e veloce',
    category: 'productivity',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/notepad', version: '1.0.0', sizeMb: 388 },
    screenshots: ['/apps/dock-notepad.png', '/wallpapers/default.jpg'],
    defaultPermissions: { network: 'deny', ssh: 'deny' },
  },
  {
    id: 'widget-store',
    definition: appDefinitions.get('widget-store')!,
    description: 'Installa e gestisci widget desktop',
    category: 'productivity',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/widget-store', version: '1.0.0', sizeMb: 24 },
    screenshots: ['/apps/dock-store.png', '/wallpapers/default.jpg'],
    defaultPermissions: { network: 'allow', ssh: 'deny' },
  },
  {
    id: 'task-manager',
    definition: appDefinitions.get('task-manager')!,
    description: 'Monitor processi e prestazioni sistema',
    category: 'system',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/task-manager', version: '1.0.0', sizeMb: 30 },
    screenshots: ['/apps/task-manager.png', '/wallpapers/default.jpg'],
    defaultPermissions: { network: 'allow', ssh: 'deny' },
  },
  {
    id: 'browser',
    definition: appDefinitions.get('browser')!,
    description: 'Browser remoto sicuro basato su Selenium e noVNC',
    category: 'media',
    container: { runtime: 'container-service' },
    package: { name: 'gh3spos/browser', version: '1.0.0', sizeMb: 934 },
    screenshots: ['/apps/task-manager.png', '/wallpapers/glass-2.png'],
    defaultPermissions: { filesystem: 'deny', ssh: 'deny' },
  },
  {
    id: 'gh3preview',
    definition: appDefinitions.get('gh3preview')!,
    description: 'Anteprima rapida dei contenuti supportati',
    category: 'productivity',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/gh3preview', version: '1.0.0', sizeMb: 28 },
    screenshots: ['/apps/preview.png', '/wallpapers/default.jpg'],
    defaultPermissions: { network: 'deny', ssh: 'deny' },
  },
  {
    id: 'vs-code',
    definition: appDefinitions.get('vs-code')!,
    description: 'Editor Visual Studio Code via vscode.dev',
    category: 'developer',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/vs-code', version: '1.0.0', sizeMb: 120 },
    screenshots: ['/apps/dock-vscode.svg', '/wallpapers/glass.png'],
    defaultPermissions: { ssh: 'deny' },
  },
  {
    id: 'gh3connect',
    definition: appDefinitions.get('gh3connect')!,
    description: 'Client SSH con tab multipli e terminale interattivo',
    category: 'developer',
    container: { runtime: 'container-service' },
    package: { name: 'gh3spos/gh3connect', version: '1.0.0', sizeMb: 74 },
    screenshots: ['/apps/dock-ssh.png', '/wallpapers/glass-2.png'],
    defaultPermissions: { filesystem: 'deny', network: 'allow', ssh: 'allow' },
  },
  {
    id: 'mail-client',
    definition: appDefinitions.get('mail-client')!,
    description: 'Client email completo con supporto provider popolari e domini custom',
    category: 'productivity',
    container: { runtime: 'embedded' },
    package: { name: 'gh3spos/mail-client', version: '1.0.0', sizeMb: 96 },
    screenshots: ['/apps/dock-mail.svg', '/wallpapers/glass.png'],
    defaultPermissions: { filesystem: 'deny', network: 'allow', ssh: 'deny' },
  },
]

const AppsContext = createContext<AppsContextType | null>(null)

export const AppsProvider = ({ children }: { children: React.ReactNode }) => {
  const [installedIds, setInstalledIds] = usePersistentStore<string[]>('apps:installed', DEFAULT_INSTALLED)
  const [enabledMap, setEnabledMap] = usePersistentStore<Record<string, boolean>>('apps:enabled', {})
  const [pinnedMap, setPinnedMap] = usePersistentStore<Record<string, boolean>>('apps:pinned', {})
  const [permissions, setPermissions] = usePersistentStore<AppPermissionMap>('apps:permissions', {})
  const [migrationDone, setMigrationDone] = usePersistentStore<boolean>(MIGRATION_ID, false)
  const [migrationEmailDone, setMigrationEmailDone] = usePersistentStore<boolean>(MIGRATION_EMAIL_ID, false)

  const catalogMap = useMemo(() => {
    const map = new Map<string, AppCatalogItem>()
    for (const item of APP_CATALOG) map.set(item.id, item)
    return map
  }, [])

  const permissionTargets = useMemo<AppPermissionTarget[]>(() => {
    const targets: AppPermissionTarget[] = []
    const catalogIds = new Set(APP_CATALOG.map((item) => item.id))

    for (const item of APP_CATALOG) {
      if (PERMISSION_HIDDEN_APPS.includes(item.id)) continue
      targets.push({
        id: item.id,
        definition: item.definition,
        defaultPermissions: item.defaultPermissions,
        isCore: CORE_APPS.includes(item.id as (typeof CORE_APPS)[number]),
        isProtected: PROTECTED_APPS.includes(item.id as (typeof PROTECTED_APPS)[number]),
      })
    }

    for (const [id, definition] of appDefinitions.entries()) {
      if (catalogIds.has(id)) continue
      if (definition.ghost) continue
      if (PERMISSION_HIDDEN_APPS.includes(id)) continue
      targets.push({
        id,
        definition,
        defaultPermissions: undefined,
        isCore: CORE_APPS.includes(id as (typeof CORE_APPS)[number]),
        isProtected: PROTECTED_APPS.includes(id as (typeof PROTECTED_APPS)[number]),
      })
    }

    return targets.sort((a, b) => a.definition.name.localeCompare(b.definition.name, 'it'))
  }, [])

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

  useEffect(() => {
    if (migrationDone) return
    setInstalledIds((prev) => {
      if (prev.includes('gh3connect')) return prev
      return [...prev, 'gh3connect']
    })
    setMigrationDone(true)
  }, [migrationDone, setInstalledIds, setMigrationDone])

  useEffect(() => {
    if (migrationEmailDone) return
    setInstalledIds((prev) => {
      if (prev.includes('mail-client')) return prev
      return [...prev, 'mail-client']
    })
    setMigrationEmailDone(true)
  }, [migrationEmailDone, setInstalledIds, setMigrationEmailDone])

  const isInstalled = (id: string) => installedIds.includes(id)
  const isEnabled = (id: string) => enabledMap[id] ?? true
  const isPinned = (id: string) => pinnedMap[id] ?? (appDefinitions.get(id)?.isPinned ?? false)
  const canLaunchApp = (id: string) => {
    const definition = appDefinitions.get(id)
    if (!definition) return false
    if (definition.ghost && !INTERNAL_LAUNCHABLE_GHOST_APPS.includes(id)) return false
    return isInstalled(id) && isEnabled(id) && getPermission(id, 'launch') === 'allow'
  }

  const getPermission = (id: string, permission: AppPermissionKey): AppPermissionState => {
    if (permission === 'launch' && CORE_APPS.includes(id as (typeof CORE_APPS)[number])) return 'allow'
    const explicit = permissions[id]?.[permission]
    if (explicit) return explicit
    const catalogDefault = catalogMap.get(id)?.defaultPermissions?.[permission]
    if (catalogDefault) return catalogDefault
    return BASE_PERMISSION_PROFILE[permission]
  }

  const canUsePermission = (id: string, permission: AppPermissionKey) => getPermission(id, permission) === 'allow'

  const isPermissionLocked = (id: string, permission: AppPermissionKey, value: AppPermissionState) => {
    if (permission === 'launch' && value === 'deny' && CORE_APPS.includes(id as (typeof CORE_APPS)[number])) return true
    return false
  }

  const setPermission = (id: string, permission: AppPermissionKey, value: AppPermissionState) => {
    if (isPermissionLocked(id, permission, value)) return
    setPermissions((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? {}),
        [permission]: value,
      },
    }))
  }

  const resetPermissions = () => setPermissions({})

  const installApp = (id: string) => {
    if (isInstalled(id)) return
    setInstalledIds(prev => [...prev, id])
  }

  const uninstallApp = (id: string) => {
    if (PROTECTED_APPS.includes(id as (typeof PROTECTED_APPS)[number])) return
    setInstalledIds(prev => prev.filter(appId => appId !== id))
  }

  const setAppEnabled = (id: string, value: boolean) => {
    if (!value && PROTECTED_APPS.includes(id as (typeof PROTECTED_APPS)[number])) return
    setEnabledMap(prev => ({ ...prev, [id]: value }))
  }

  const setPinned = (id: string, value: boolean) => {
    setPinnedMap(prev => ({ ...prev, [id]: value }))
  }

  const apps = useMemo(() => {
    const next = new Map<string, AppDefinition>()
    for (const [id, definition] of appDefinitions.entries()) {
      if (!canLaunchApp(id)) continue
      const pinned = pinnedMap[id] ?? (appDefinitions.get(id)?.isPinned ?? false)
      next.set(id, { ...definition, isPinned: pinned })
    }
    return next
  }, [installedIds, enabledMap, pinnedMap, permissions])

  const value: AppsContextType = {
    apps,
    catalog: APP_CATALOG,
    permissionTargets,
    permissions,
    permissionKeys: PERMISSION_KEYS,
    isInstalled,
    isEnabled,
    isPinned,
    canLaunchApp,
    isPermissionLocked,
    getPermission,
    canUsePermission,
    setPermission,
    resetPermissions,
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
