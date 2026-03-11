import { useWindowManager } from '@/providers/window-manager'
import { useApps } from '@/providers/apps'
import type { AppDefinition } from '@/types'
import { useState, useRef, useEffect, useMemo } from 'react'
import { usePreviewRefs } from "@/providers/preview-refs"
import html2canvas from 'html2canvas-pro'
import { Minimize, PinIcon, PinOffIcon, X } from 'lucide-react'
import { usePersistentStore } from '@/providers/persistent-store'
import { DEFAULT_DESKTOP_SETTINGS, resolveDesktopSettings, type DesktopSettings } from '@/config/system-settings'

export const Dock = () => {
  const { apps, setPinned, isPinned } = useApps()
  const { windows, openWindow, focusWindow, minimizeWindow, closeWindow } = useWindowManager()
  const [hoveredAppId, setHoveredAppId] = useState<string | null>(null)
  const [dockMouseAxis, setDockMouseAxis] = useState<number | null>(null)
  const [clickedAppId, setClickedAppId] = useState<string | null>(null)
  const [isDockHovered, setIsDockHovered] = useState(false)
  const [isNearRevealEdge, setIsNearRevealEdge] = useState(false)
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const previousMinimizedStateRef = useRef<Record<string, boolean>>({})
  const { getPreviewRef } = usePreviewRefs()
  const [storedSettings] = usePersistentStore<DesktopSettings>('gh3sp:settings', DEFAULT_DESKTOP_SETTINGS)
  const settings = useMemo(() => resolveDesktopSettings(storedSettings), [storedSettings])

  // Per il context menu
  const [contextMenu, setContextMenu] = useState<{
    appId: string
    position: { x: number, y: number }
    direction: 'up' | 'right' | 'left'
  } | null>(null)
	
  const menuRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
	if (!contextMenu) return

	const handleClickOutside = (event: MouseEvent) => {
		if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
		setContextMenu(null) // chiudi menu
		}
	}

	document.addEventListener('mousedown', handleClickOutside)

	// pulizia quando il menu si chiude o il componente si smonta
	return () => {
		document.removeEventListener('mousedown', handleClickOutside)
	}
  }, [contextMenu])
	

  useEffect(() => {
    if (!hoveredAppId) return

    let cancelled = false
    const matching = windows.filter(w => w.appId === hoveredAppId && !w.isMinimized)

    const buildPreviews = async () => {
      for (const win of matching) {
        if (cancelled || previews[win.id]) continue
        const el = getPreviewRef(win.id)
        if (!el) continue

        const canvas = await html2canvas(el, {
          backgroundColor: null,
          removeContainer: true,
          scale: 1,
        })

        if (cancelled) return
        setPreviews(prev => ({ ...prev, [win.id]: canvas.toDataURL('image/webp', 0.72) }))
      }
    }

    buildPreviews()
    return () => {
      cancelled = true
    }
  }, [hoveredAppId, windows, getPreviewRef, previews])

  useEffect(() => {
    let cancelled = false

    const captureMinimizedTransitions = async () => {
      for (const win of windows) {
        const wasMinimized = previousMinimizedStateRef.current[win.id] === true
        const isNowMinimized = win.isMinimized === true

        if (!wasMinimized && isNowMinimized && !previews[win.id]) {
          const el = getPreviewRef(win.id)
          if (!el) continue

          try {
            const canvas = await html2canvas(el, {
              backgroundColor: null,
              removeContainer: true,
              scale: 1,
            })

            if (cancelled) return
            setPreviews((prev) => {
              if (prev[win.id]) return prev
              return { ...prev, [win.id]: canvas.toDataURL('image/webp', 0.72) }
            })
          } catch {
            // best effort
          }
        }
      }

      if (!cancelled) {
        previousMinimizedStateRef.current = windows.reduce<Record<string, boolean>>((acc, win) => {
          acc[win.id] = Boolean(win.isMinimized)
          return acc
        }, {})
      }
    }

    void captureMinimizedTransitions()
    return () => {
      cancelled = true
    }
  }, [windows, previews, getPreviewRef])

  const extraWindows: Map<string, AppDefinition> = useMemo(() => new Map(
    windows
      .filter(win => ![...apps.entries()].some(([id, app]) => id === win.appId && app.isPinned))
      .filter(win => !win.ghost)
      .map(win => [
        win.appId,
        {
          id: win.id,
          name: win.title,
          icon: win.icon || "default-icon.svg",
          component: apps.get(win.appId)?.component ?? (() => null),
          isPinned: false,
          ghost: win.ghost,
          defaultSize: win.size,
        } as AppDefinition
      ])
  ), [windows, apps])

  const dockApps: [string, AppDefinition][] = useMemo(() => [
    ...[...apps.entries()].filter((entry) => entry[1].isPinned && !entry[1].ghost),
    ...[...extraWindows.entries()]
  ], [extraWindows, apps])

  const handleClick = ([id, app]: [string, AppDefinition]) => {
    const matchingWindows = windows.filter(w => w.appId === id)
    const isOpen = matchingWindows.length > 0

    if (!isOpen) {
      openWindow(app, id)
      return
    }

    const preferredWindow = matchingWindows.find((w) => !w.isMinimized) ?? matchingWindows[0]
    focusWindow(preferredWindow.id, true)
  }

  // Funzione per aprire il context menu
  const handleContextMenu = (e: React.MouseEvent, appId: string) => {
	e.preventDefault()
	const target = e.currentTarget as HTMLElement
	const rect = target.getBoundingClientRect()

  const clickX = rect.left + rect.width / 2
  const clickY = rect.top + rect.height / 2
  const direction = settings.dockPosition === 'left'
    ? 'right'
    : settings.dockPosition === 'right'
      ? 'left'
      : 'up'

	setContextMenu({
		appId,
		position: { x: clickX, y: clickY },
    direction
	})
  }

  const closeContextMenu = () => setContextMenu(null)

  const schedulePreviewHide = (delay = 220) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    hoverTimeout.current = setTimeout(() => setHoveredAppId(null), delay)
  }

  const handleDockLeave = () => {
    setDockMouseAxis(null)
    setIsDockHovered(false)
    schedulePreviewHide(160)
  }

  const dockPositionClass = settings.dockPosition === 'left'
    ? 'left-4 top-1/2 -translate-y-1/2 flex-col'
    : settings.dockPosition === 'right'
      ? 'right-4 top-1/2 -translate-y-1/2 flex-col'
      : 'bottom-4 left-1/2 -translate-x-1/2 flex-row'

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const width = window.innerWidth
      const height = window.innerHeight

      if (settings.dockPosition === 'bottom') {
        setIsNearRevealEdge(event.clientY >= height - 90)
        return
      }

      if (settings.dockPosition === 'left') {
        setIsNearRevealEdge(event.clientX <= 90)
        return
      }

      setIsNearRevealEdge(event.clientX >= width - 90)
    }

    window.addEventListener('mousemove', onMouseMove)
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [settings.dockPosition])

  const hasMaximizedWindow = windows.some((w) => w.isMaximized)
  const shouldRevealWhenMaximized = hasMaximizedWindow ? (isNearRevealEdge || isDockHovered || hoveredAppId !== null) : true
  const shouldRevealWhenAutoHide = settings.dockAutoHide ? (isNearRevealEdge || isDockHovered || hoveredAppId !== null) : true
  const shouldHideDock = hasMaximizedWindow
    ? !shouldRevealWhenMaximized
    : settings.dockAutoHide && !shouldRevealWhenAutoHide

  const hiddenDockTransform = settings.dockPosition === 'bottom'
    ? 'translate(0, 28px)'
    : settings.dockPosition === 'left'
      ? 'translate(-28px, 0)'
      : 'translate(28px, 0)'

  const previewPanelPositionClass = settings.dockPosition === 'left'
    ? 'left-full ml-3 top-1/2 -translate-y-1/2'
    : settings.dockPosition === 'right'
      ? 'right-full mr-3 top-1/2 -translate-y-1/2'
      : 'bottom-20 left-1/2 -translate-x-1/2'

  // Azioni menu contestuale
  const handleContextMenuAction = (action: string, appId: string) => {
    const matchingWindows = windows.filter(w => w.appId === appId)
    switch (action) {
      case 'open-new': {
        const app = apps.get(appId)
        if (app) openWindow(app, appId)
        break
      }
      case 'remove-pinned': {
        const app = apps.get(appId)
        if (app) setPinned(appId, false)
        break
      }
      case 'add-pinned': {
        const app = apps.get(appId)
        if (app) setPinned(appId, true)
        break
      }
      case 'minimize-all':
        matchingWindows.forEach(w => minimizeWindow(w.id))
        break
      case 'close-all':
        matchingWindows.forEach(w => closeWindow(w.id))
        break
    }
    closeContextMenu()
  }

    return (
    <>
      {/* Dock normale */}
      <div
        className={`fixed ${dockPositionClass} z-[95] flex items-end gap-3 px-4 py-2 rounded-2xl border border-white/25 bg-white/12 backdrop-blur-2xl shadow-[0_15px_45px_rgba(0,0,0,0.5)] transition-all duration-200`}
        style={{
          display: 'flex',
          opacity: shouldHideDock ? 0.02 : 1,
          transform: shouldHideDock ? hiddenDockTransform : undefined,
          pointerEvents: shouldHideDock ? 'none' : 'auto',
        }}
        onMouseMove={(e) => setDockMouseAxis(settings.dockPosition === 'bottom' ? e.clientX : e.clientY)}
        onMouseEnter={() => setIsDockHovered(true)}
        onMouseLeave={handleDockLeave}
      >
        {dockApps.map(([id, app]) => {
          const matchingWindows = windows.filter(w => w.appId === id)
          const isOpen = matchingWindows.length > 0
          const iconRect = document.getElementById(`dock-icon-${id}`)?.getBoundingClientRect()
          const iconCenter = settings.dockPosition === 'bottom'
            ? (iconRect?.left ?? 0) + 24
            : (iconRect?.top ?? 0) + 24
          const iconDistance = dockMouseAxis === null ? 200 : Math.abs(dockMouseAxis - iconCenter)
          const scale = !settings.dockMagnification || dockMouseAxis === null ? 1 : Math.max(1, 1.75 - iconDistance / 110)
          const lift = Math.max(0, (scale - 1) * 18)
          const iconSize = settings.dockIconSize

          return (
            <div
              key={id}
              className="relative group"
              onMouseEnter={() => {
                if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
                setHoveredAppId(id)
              }}
              onMouseLeave={() => {
                schedulePreviewHide(260)
              }}
              onContextMenu={(e) => handleContextMenu(e, id)}
            >
              <button
                id={`dock-icon-${id}`}
                onClick={() => {
                  setClickedAppId(id)
                  handleClick([id, app])
                  setTimeout(() => setClickedAppId((current) => current === id ? null : current), 360)
                }}
                className="relative flex flex-col items-center justify-center gap-1 p-1 rounded-xl cursor-pointer transition-transform duration-150 ease-out"
                aria-label={`Apri ${app.name}`}
                style={{
                  transform: `translateY(${-lift}px) scale(${scale})`,
                }}
              >
                <div
                  className={`flex items-center justify-center text-white rounded-xl overflow-hidden transition-all duration-150 ${clickedAppId === id ? 'dock-bounce' : ''}`}
                  style={{ width: `${iconSize + 8}px`, height: `${iconSize + 8}px` }}
                >
                  {typeof app.icon === 'string' ? (
                    <img
                      src={`/apps/${app.icon}`}
                      alt={app.name}
                      className="rounded-lg select-none shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
                      style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                      draggable={false}
                    />
                  ) : (
                    app.icon
                  )}
                </div>
                {isOpen && (
                  <span
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  />
                )}
              </button>

              {/* Hover panel con finestre multiple (disabilitato se contextMenu è aperto) */}
              {hoveredAppId === id && !contextMenu && (
                <div
                  onMouseEnter={() => {
                    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
                  }}
                  onMouseLeave={() => schedulePreviewHide(220)}
                  className={`absolute ${previewPanelPositionClass} bg-[#111827]/88 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.52)] z-40 p-2.5 max-h-[62vh] overflow-y-auto w-[292px]`}
                >
                  {matchingWindows.length === 0 && (
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 text-center">
                      {app.name}
                    </div>
                  )}
                  {matchingWindows.map(win => (
                    <div
                      key={win.id}
                      onClick={() => { focusWindow(win.id, true); setHoveredAppId(null) }}
                      className="group rounded-xl border border-white/10 bg-white/[0.05] hover:bg-white/[0.1] transition cursor-pointer overflow-hidden mb-2 last:mb-0"
                    >
                      <div className='relative w-full gap-2 flex items-center px-2.5 py-2 border-b border-white/10' title={win.title || app.name}>
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap w-full text-left text-xs text-white/90">{win.title || app.name}</span>
                        <button
                          className='h-5 w-5 inline-flex items-center justify-center rounded-md bg-rose-500/75 hover:bg-rose-500 text-white/95 cursor-pointer text-[11px] leading-none'
                          onClick={(event) => {
                            event.stopPropagation()
                            closeWindow(win.id)
                            setHoveredAppId(null)
                          }}
                        >
                          ×
                        </button>
                      </div>

                      <div className="p-2">
                        <div className="h-[136px] w-full origin-top-left overflow-hidden pointer-events-none rounded-lg border border-white/10 bg-black/35 shadow-inner">
                          {previews[win.id] ? (
                            <img
                              src={previews[win.id]}
                              alt={win.title || app.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-[11px] text-white/55 px-3 text-center">
                              {win.isMinimized ? (
                                <div className="space-y-1.5">
                                  <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-100">
                                    <Minimize className="h-3 w-3" /> Minimizzata
                                  </div>
                                  <p>Clicca per ripristinare la finestra.</p>
                                </div>
                              ) : (
                                'Anteprima in caricamento...'
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Context Menu fisso (fisso bottom-left, ad esempio) */}
  {contextMenu && (
		<ul
			onContextMenu={e => e.preventDefault()}
			style={{
				position: 'fixed',
        left: contextMenu.direction === 'up'
          ? contextMenu.position.x
          : contextMenu.direction === 'right'
            ? contextMenu.position.x + 42
            : contextMenu.position.x - 42,
        top: contextMenu.direction === 'up'
          ? contextMenu.position.y - (windows.filter(w => w.appId === contextMenu.appId).length > 0 ? 130 : 55)
          : contextMenu.position.y,
				minWidth: 180,
				maxWidth: 250,
				padding: '8px 0',
				borderRadius: 12,
        backgroundColor: 'rgba(17, 24, 39, 0.88)',
        backdropFilter: 'blur(18px)',
				boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
				zIndex: 9999,
				userSelect: 'none',
        transform: contextMenu.direction === 'up'
          ? 'translateX(-50%)'
          : contextMenu.direction === 'right'
            ? 'translateY(-50%)'
            : 'translate(-100%, -50%)'
			}}
			className="liquid-glass-menu"
			ref={menuRef}
		>
			<li
			
				className="context-menu-item flex items-center gap-2"
				onClick={() => handleContextMenuAction('open-new', contextMenu.appId)}
			>
				{typeof apps.get(contextMenu.appId)?.icon === 'string' ? (
				<img
					src={`/apps/${apps.get(contextMenu.appId)?.icon}`}
					alt={apps.get(contextMenu.appId)?.name}
					className="w-4 h-4 select-none"
					draggable={false}
				/>
				) : (
				apps.get(contextMenu.appId)?.icon
				)}
				{apps.get(contextMenu.appId)?.name}
			</li>
			<li
			
				className="context-menu-item flex items-center gap-2"
        onClick={() => handleContextMenuAction(isPinned(contextMenu.appId) ? 'remove-pinned' : 'add-pinned', contextMenu.appId)}
			>
				{isPinned(contextMenu.appId) ? <PinOffIcon className="w-4 h-4" /> : <PinIcon className="w-4 h-4" />}
        {isPinned(contextMenu.appId) ? "Rimuovi dalla barra" : "Aggiungi alla barra"}
			</li>
			{
				windows.filter(w => w.appId === contextMenu.appId).length > 0 &&
				<li
					className="context-menu-item flex items-center gap-2"
					onClick={() => handleContextMenuAction('minimize-all', contextMenu.appId)}
				>
					<Minimize className="w-4 h-4" />
					{windows.filter(w => w.appId === contextMenu.appId).length > 1 ? "Minimizza tutte le finestre" : "Minimizza finestra"}
				</li>
			}
			{
				windows.filter(w => w.appId === contextMenu.appId).length > 0 &&
				<li
					className="context-menu-item flex items-center gap-2"
					onClick={() => handleContextMenuAction('close-all', contextMenu.appId)}
					>
					<X className="w-4 h-4" />
          {windows.filter((win) => win.appId === contextMenu.appId).length > 1 ? "Chiudi tutte le finestre" : "Chiudi finestra"}
				</li>
			}
		</ul>
      )}

	<style>
		{`
        .context-menu-item {
          padding: 8px 20px;
          cursor: pointer;
          color: white;
      	  font-size: 12px;
          font-weight: 500;
          transition: background-color 0.15s ease, color 0.15s ease;
          user-select: none;
          white-space: nowrap;
        }

        .context-menu-item:hover {
          background-color: rgba(255, 255, 255, 0.2);
          color: #3b82f6;
        }
      `}</style>
    </>
  )
}

