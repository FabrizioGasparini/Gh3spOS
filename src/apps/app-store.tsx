import { useEffect, useMemo, useState } from 'react'
import { useApps } from '@/providers/apps'
import { useWindowManager } from '@/providers/window-manager'
import { useNotifications } from '@/providers/notifications'

export const AppStore: React.FC = () => {
  const { catalog, isInstalled, isEnabled, isPinned, canUsePermission, installApp, uninstallApp, setAppEnabled, setPinned } = useApps()
  const { openWindow, windows, closeWindow } = useWindowManager()
  const { notify } = useNotifications()
  const [query, setQuery] = useState('')
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [selectedScreenshot, setSelectedScreenshot] = useState(0)
  const [jobStatus, setJobStatus] = useState<Record<string, 'idle' | 'installing' | 'uninstalling'>>({})
  const [jobMessage, setJobMessage] = useState<Record<string, string>>({})
  const [secureBrowserStatus, setSecureBrowserStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  useEffect(() => {
    let disposed = false

    const checkSecureBrowserStatus = async () => {
      try {
        const response = await fetch('http://localhost:3001/secure-browser/status', { method: 'GET', cache: 'no-store' })
        const payload = await response.json().catch(() => ({ ok: false }))
        if (disposed) return
        setSecureBrowserStatus(response.ok && payload?.online ? 'online' : 'offline')
      } catch {
        if (!disposed) setSecureBrowserStatus('offline')
      }
    }

    void checkSecureBrowserStatus()
    const timer = setInterval(() => { void checkSecureBrowserStatus() }, 10000)
    return () => {
      disposed = true
      clearInterval(timer)
    }
  }, [])

  const formatPackageSize = (sizeMb: number) => {
    if (sizeMb >= 1024) {
      return `${(sizeMb / 1024).toFixed(2)} GB`
    }
    return `${sizeMb} MB`
  }

  const appImage = (icon?: string) => (icon ? `/apps/${icon}` : '/apps/default-icon.svg')
  const runtimeLabel = (runtime: (typeof catalog)[number]['container']['runtime']) => {
    if (runtime === 'container-service') return 'Selenium remoto'
    return 'Embedded'
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return catalog
    const term = query.toLowerCase()
    return catalog.filter(item =>
      item.definition.name.toLowerCase().includes(term) ||
      item.id.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term)
    )
  }, [catalog, query])

  const featured = filtered.slice(0, 3)
  const groupedByCategory = useMemo(() => {
    const order: Array<(typeof catalog)[number]['category']> = ['system', 'productivity', 'developer', 'media']
    const grouped = new Map<(typeof catalog)[number]['category'], (typeof catalog)[number][]>()
    for (const category of order) grouped.set(category, [])
    for (const item of filtered) grouped.get(item.category)?.push(item)
    return order
      .map((category) => ({ category, items: grouped.get(category) ?? [] }))
      .filter((group) => group.items.length > 0)
  }, [catalog, filtered])

  const categoryLabel = (category: (typeof catalog)[number]['category']) => {
    if (category === 'system') return 'Sistema'
    if (category === 'productivity') return 'Produttività'
    if (category === 'developer') return 'Sviluppo'
    return 'Media'
  }

  const selected = useMemo(() => catalog.find((item) => item.id === selectedAppId) ?? null, [catalog, selectedAppId])

  const selectedScreenshots = useMemo(() => {
    if (!selected) return []
    if (selected.screenshots && selected.screenshots.length > 0) return selected.screenshots
    return [appImage(selected.definition.icon)]
  }, [selected])

  const openAppFromStore = async (item: (typeof catalog)[number]) => {
    if (!canUsePermission(item.id, 'launch')) {
      const message = `Permesso negato: ${item.definition.name} non può essere avviata.`
      setJobMessage((prev) => ({ ...prev, [item.id]: message }))
      if (canUsePermission('app-store', 'notifications')) {
        notify(message, 'warning')
      }
      return
    }
    if (!isInstalled(item.id)) {
      const ok = await installAppRuntime(item)
      if (!ok) return
    }
    if (!isEnabled(item.id)) setAppEnabled(item.id, true)
    openWindow(item.definition, item.id)
  }

  const installAppRuntime = async (item: (typeof catalog)[number]) => {
    const appId = item.id
    setJobStatus((prev) => ({ ...prev, [appId]: 'installing' }))
    setJobMessage((prev) => ({ ...prev, [appId]: 'Installazione in corso...' }))

    try {
      installApp(appId)
      setJobMessage((prev) => ({ ...prev, [appId]: 'Installazione completata' }))
      return true
    } catch (error) {
      setJobMessage((prev) => ({ ...prev, [appId]: `Errore installazione: ${String(error)}` }))
      return false
    } finally {
      setJobStatus((prev) => ({ ...prev, [appId]: 'idle' }))
    }
  }

  const uninstallAppRuntime = async (item: (typeof catalog)[number]) => {
    const appId = item.id
    setJobStatus((prev) => ({ ...prev, [appId]: 'uninstalling' }))
    setJobMessage((prev) => ({ ...prev, [appId]: 'Disinstallazione in corso...' }))

    try {
      uninstallApp(appId)
      windows.filter((window) => window.appId === appId).forEach((window) => closeWindow(window.id))
      setJobMessage((prev) => ({ ...prev, [appId]: 'Disinstallazione completata' }))
      return true
    } catch (error) {
      setJobMessage((prev) => ({ ...prev, [appId]: `Errore disinstallazione: ${String(error)}` }))
      return false
    } finally {
      setJobStatus((prev) => ({ ...prev, [appId]: 'idle' }))
    }
  }

  if (selected) {
    const installed = isInstalled(selected.id)
    const enabled = isEnabled(selected.id)
    const pinned = isPinned(selected.id)
    const protectedApp = selected.id === 'settings' || selected.id === 'file-explorer' || selected.id === 'app-store'
    const currentJob = jobStatus[selected.id] ?? 'idle'
    const isBusy = currentJob !== 'idle'

    return (
      <div className="h-full w-full p-5 text-white overflow-auto custom-scroll bg-gradient-to-b from-[#10141f]/95 via-[#0c1220]/95 to-[#0a0f1d]/95 rounded-xl">
        <button
          onClick={() => {
            setSelectedAppId(null)
            setSelectedScreenshot(0)
          }}
          className="mb-4 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 hover:bg-white/15 text-sm"
        >
          ← Torna allo Store
        </button>

        <div className="rounded-3xl border border-white/20 bg-white/6 overflow-hidden">
          <div className="relative min-h-[260px]">
            <img
              src={selectedScreenshots[selectedScreenshot] ?? appImage(selected.definition.icon)}
              onError={(e) => { e.currentTarget.src = '/apps/default-icon.svg' }}
              alt={selected.definition.name}
              className="absolute inset-0 w-full h-full object-cover opacity-35"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
            <div className="relative p-6 flex items-end min-h-[260px]">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/65">{selected.category}</p>
                <h2 className="text-4xl font-semibold leading-tight">{selected.definition.name}</h2>
                <p className="text-white/80 mt-2 max-w-3xl">{selected.description}</p>
              </div>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-white/15 bg-black/25 p-4">
                <h3 className="text-lg font-semibold">Screenshots</h3>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                  {selectedScreenshots.map((screenshot, idx) => (
                    <button
                      key={`${selected.id}-shot-${idx}`}
                      onClick={() => setSelectedScreenshot(idx)}
                      className={`relative overflow-hidden rounded-xl border ${idx === selectedScreenshot ? 'border-blue-400/90' : 'border-white/20'} bg-black/30 h-24`}
                    >
                      <img
                        src={screenshot}
                        onError={(e) => { e.currentTarget.src = '/apps/default-icon.svg' }}
                        alt={`${selected.definition.name} screenshot ${idx + 1}`}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/15 bg-black/25 p-4">
                <h3 className="text-lg font-semibold">Informazioni</h3>
                <div className="mt-3 space-y-1.5 text-sm text-white/80">
                  <p><span className="text-white/55">App ID:</span> {selected.id}</p>
                  <p><span className="text-white/55">Package:</span> {selected.package.name}</p>
                  <p><span className="text-white/55">Versione:</span> {selected.package.version}</p>
                  <p><span className="text-white/55">Dimensione:</span> {formatPackageSize(selected.package.sizeMb)}</p>
                  <p><span className="text-white/55">Runtime:</span> {runtimeLabel(selected.container.runtime)}</p>
                  {selected.id === 'browser' && (
                    <p>
                      <span className="text-white/55">Stato servizio:</span>{' '}
                      <span className={secureBrowserStatus === 'online' ? 'text-emerald-200' : secureBrowserStatus === 'offline' ? 'text-rose-200' : 'text-amber-200'}>
                        {secureBrowserStatus === 'online' ? 'Online' : secureBrowserStatus === 'offline' ? 'Offline' : 'Verifica...'}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/15 bg-black/25 p-4 text-sm text-white/80">
                <h3 className="text-lg font-semibold mb-2">Dettagli deployment</h3>
                {selected.id === 'browser' ? (
                  <p>
                    Browser eseguito come sessione remota Selenium/noVNC. Non è più embedded nel renderer locale di Gh3spOS.
                  </p>
                ) : (
                  <p>
                    Le app vengono eseguite direttamente nel runtime locale di Gh3spOS, senza servizi container separati.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-black/25 p-4 h-fit">
              <h3 className="text-lg font-semibold">Azioni</h3>
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => { void openAppFromStore(selected) }}
                  disabled={isBusy}
                  className="w-full px-3 py-2 rounded-xl bg-emerald-500/85 hover:bg-emerald-500 disabled:opacity-60 text-sm font-medium"
                >
                  {installed ? 'Apri' : isBusy ? 'Attendi...' : 'Ottieni e Apri'}
                </button>

                {installed ? (
                  <button
                    onClick={() => { void uninstallAppRuntime(selected) }}
                    disabled={protectedApp || isBusy}
                    className="w-full px-3 py-2 rounded-xl bg-rose-500/80 hover:bg-rose-500 disabled:opacity-50 disabled:hover:bg-rose-500/80 text-sm"
                  >
                    {currentJob === 'uninstalling' ? 'Disinstallazione...' : 'Disinstalla'}
                  </button>
                ) : (
                  <button
                    onClick={() => { void installAppRuntime(selected) }}
                    disabled={isBusy}
                    className="w-full px-3 py-2 rounded-xl bg-blue-500/85 hover:bg-blue-500 disabled:opacity-60 text-sm font-medium"
                  >
                    {currentJob === 'installing' ? 'Installazione...' : 'Ottieni'}
                  </button>
                )}

                {jobMessage[selected.id] && (
                  <p className="text-xs text-white/70">{jobMessage[selected.id]}</p>
                )}

                <label className="text-xs flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/20">
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={!installed || protectedApp || isBusy}
                    onChange={(e) => setAppEnabled(selected.id, e.target.checked)}
                  />
                  Abilitata
                </label>

                <label className="text-xs flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/20">
                  <input
                    type="checkbox"
                    checked={pinned}
                    disabled={!installed || isBusy}
                    onChange={(e) => setPinned(selected.id, e.target.checked)}
                  />
                  Pin nel Dock
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full p-5 text-white overflow-auto custom-scroll ">
      <div className="rounded-3xl border border-white/20 bg-white/15 backdrop-blur-xl p-5 mb-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Today</p>
        <h2 className="text-3xl font-semibold leading-tight mt-1">App Store</h2>
        <p className="text-sm text-white/70 mt-2">Scopri, installa e gestisci le app del tuo desktop.</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca app, id o categoria..."
            className="px-4 py-2.5 rounded-full bg-white/10 border border-white/20 outline-none text-sm w-full md:w-[360px]"
          />
          <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-white/70">
            {filtered.length} app
          </span>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">In evidenza</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {featured.map((item) => (
            <button
              key={`featured-${item.id}`}
              onClick={() => {
                setSelectedAppId(item.id)
                setSelectedScreenshot(0)
              }}
              className="relative overflow-hidden rounded-2xl border border-white/15 bg-black/20 min-h-[180px] text-left hover:border-white/35 transition"
            >
              <img
                src={appImage(item.definition.icon)}
                onError={(e) => { e.currentTarget.src = '/apps/default-icon.svg' }}
                alt={item.definition.name}
                className="absolute inset-0 w-full h-full object-cover opacity-30"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
              <div className="relative p-4 flex flex-col h-full justify-end">
                <p className="text-[10px] uppercase tracking-widest text-white/70">{item.category}</p>
                <p className="text-xl font-semibold">{item.definition.name}</p>
                <p className="text-xs text-white/75 line-clamp-2">{item.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Tutte le app</h3>
        <div className="space-y-5">
          {groupedByCategory.map((group) => (
            <div key={`group-${group.category}`}>
              <h4 className="text-sm font-semibold text-white/80 mb-2">{categoryLabel(group.category)}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.items.map((item) => {
                  const installed = isInstalled(item.id)
                  const enabled = isEnabled(item.id)

                  return (
                    <div key={item.id} className="rounded-2xl border border-white/20 bg-white/8 overflow-hidden">
                      <div className="p-4 flex items-start gap-3">
                        <img
                          src={appImage(item.definition.icon)}
                          onError={(e) => { e.currentTarget.src = '/apps/default-icon.svg' }}
                          alt={item.definition.name}
                          className="h-14 w-14 rounded-2xl object-cover border border-white/15 bg-black/30"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <button className="min-w-0 text-left" onClick={() => {
                              setSelectedAppId(item.id)
                              setSelectedScreenshot(0)
                            }}>
                              <p className="font-semibold truncate">{item.definition.name}</p>
                              <p className="text-xs text-white/65 truncate">{item.id} · {categoryLabel(item.category)}</p>
                            </button>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 border border-white/20 whitespace-nowrap">
                                {runtimeLabel(item.container.runtime)}
                              </span>
                              {item.id === 'browser' && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${secureBrowserStatus === 'online'
                                  ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-200'
                                  : secureBrowserStatus === 'offline'
                                    ? 'border-rose-300/40 bg-rose-400/15 text-rose-200'
                                    : 'border-amber-300/40 bg-amber-400/15 text-amber-200'
                                  }`}>
                                  Secure {secureBrowserStatus === 'online' ? 'Online' : secureBrowserStatus === 'offline' ? 'Offline' : 'Checking'}
                                </span>
                              )}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${installed
                                ? enabled
                                  ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-200'
                                  : 'border-amber-300/40 bg-amber-400/15 text-amber-200'
                                : 'border-slate-300/30 bg-slate-400/10 text-slate-200/90'
                                }`}>
                                {installed ? (enabled ? 'Installata' : 'Installata (disabilitata)') : 'Non installata'}
                              </span>
                            </div>
                          </div>

                          <button onClick={() => {
                            setSelectedAppId(item.id)
                            setSelectedScreenshot(0)
                          }} className="text-left w-full">
                            <p className="text-sm text-white/80 mt-2">{item.description}</p>
                          </button>

                          <div className="mt-2 text-xs text-white/70 space-y-1">
                            <p>Package: {item.package.name}@{item.package.version}</p>
                            <p>Size: {formatPackageSize(item.package.sizeMb)}</p>
                            {jobMessage[item.id] && <p className="text-white/85">{jobMessage[item.id]}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
