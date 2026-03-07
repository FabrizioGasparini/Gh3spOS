import { useWindowManager } from '@/providers/window-manager'
import { useApps } from '@/providers/apps'
import type { AppDefinition } from '@/types'
import { useState, useRef, useEffect, useMemo } from 'react'
import { usePreviewRefs } from "@/providers/preview-refs"
import html2canvas from 'html2canvas-pro'
import { Minimize, X } from 'lucide-react'
import { usePersistentStore } from '@/providers/persistent-store'
import { DEFAULT_DESKTOP_SETTINGS, resolveDesktopSettings, type DesktopSettings } from '@/config/system-settings'

export const Dock = () => {
  const { apps } = useApps()
  const { windows, openWindow, focusWindow, minimizeWindow, closeWindow } = useWindowManager()
  const [hoveredAppId, setHoveredAppId] = useState<string | null>(null)
  const [dockMouseAxis, setDockMouseAxis] = useState<number | null>(null)
  const [clickedAppId, setClickedAppId] = useState<string | null>(null)
  const [isDockHovered, setIsDockHovered] = useState(false)
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const { getPreviewRef } = usePreviewRefs()
  const [storedSettings] = usePersistentStore<DesktopSettings>('gh3sp:settings', DEFAULT_DESKTOP_SETTINGS)
  const settings = useMemo(() => resolveDesktopSettings(storedSettings), [storedSettings])

  // Per il context menu
  const [contextMenu, setContextMenu] = useState<{
    appId: string
    position: { x: number, y: number }
    openUpwards: boolean
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

	// Posizione orizzontale: centro dell'icona
	const clickX = rect.left + rect.width / 2
	// Posizione verticale: sopra l'icona
	const clickY = rect.top

	// Apri verso l'alto sempre (o mantieni la condizione se preferisci)
	const openUpwards = true

	setContextMenu({
		appId,
		position: { x: clickX, y: clickY },
		openUpwards
	})
  }

  const closeContextMenu = () => setContextMenu(null)

  const handleDockLeave = () => {
    setDockMouseAxis(null)
    setIsDockHovered(false)
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    hoverTimeout.current = setTimeout(() => setHoveredAppId(null), 120)
  }

  const dockPositionClass = settings.dockPosition === 'left'
    ? 'left-4 top-1/2 -translate-y-1/2 flex-col'
    : settings.dockPosition === 'right'
      ? 'right-4 top-1/2 -translate-y-1/2 flex-col'
      : 'bottom-4 left-1/2 -translate-x-1/2 flex-row'

  // Azioni menu contestuale
  const handleContextMenuAction = (action: string, appId: string) => {
    const matchingWindows = windows.filter(w => w.appId === appId)
    switch (action) {
      case 'open-new': {
        const app = apps.get(appId)
        if (app) openWindow(app, appId)
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
        style={{ display: windows.filter(w => w.isMaximized).length > 0 ? 'none' : 'flex', opacity: settings.dockAutoHide && !isDockHovered ? 0.12 : 1 }}
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
                hoverTimeout.current = setTimeout(() => setHoveredAppId(null), 200)
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
                  onMouseLeave={() => setHoveredAppId(null)}
                  className="absolute flex gap-1 bottom-20 left-1/2 -translate-x-1/2 bg-black/45 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl z-40 p-2 space-y-2 max-h-50 overflow-y-auto"
                >
                  {matchingWindows.length == 0 && <span className="truncate text-center">{app.name}</span>}
                  {matchingWindows.map(win => (
                    <div
                      key={win.id}
                      onClick={() => { focusWindow(win.id, true); setHoveredAppId(null) }}
                      className="flex flex-col max-w-60 items-center gap-2 px-1 py-1 text-white text-sm bg-black/20 hover:bg-white/5 rounded cursor-pointer"
                    >
                      <div className='relative w-full gap-2 flex items-center' title={win.title || app.name}>
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[150px] ml-2 w-full text-left">{win.title || app.name}</span>
                        <button className='w-3 h-3 px-1.5 mr-2 rounded-full bg-red-500 hover:bg-red-400 cursor-pointer' onClick={() => { closeWindow(win.id); setHoveredAppId(null) }}></button>
                      </div>
                      {
                        matchingWindows.length > 0 &&
                        <div className="w-44 h-fit origin-top-left overflow-hidden pointer-events-none rounded border border-white/10 shadow-md">
                          <img
                            src={previews[win.id]}
                            alt="Loading Preview..."
                            className="w-full object-cover rounded"
                          />
                        </div>
                      }
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
				left: contextMenu.position.x,
				top: contextMenu.openUpwards
					? contextMenu.position.y - (windows.filter(w => w.appId === contextMenu.appId).length > 0 ? 130 : 55) // menu sopra l'icona
					: contextMenu.position.y,
				minWidth: 180,
				maxWidth: 250,
				padding: '8px 0',
				borderRadius: 12,
				backgroundColor: 'rgba(255, 255, 255, 0.12)',
				backdropFilter: 'blur(12px)',
				boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
				zIndex: 9999,
				userSelect: 'none',
				transform: 'translateX(-50%)' // per centrare orizzontalmente rispetto all'icona
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

