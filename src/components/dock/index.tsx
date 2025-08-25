import { useWindowManager } from '@/providers/window-manager'
import { apps } from '@/apps/definitions'
import type { AppDefinition } from '@/types'
import { nanoid } from 'nanoid'
import { useState, useRef, useEffect } from 'react'
import { usePreviewRefs } from "@/providers/preview-refs"
import html2canvas from 'html2canvas-pro'
import { Minimize, X } from 'lucide-react'

export const Dock = () => {
  const { windows, openWindow, focusWindow, minimizeWindow, closeWindow } = useWindowManager()
  const [hoveredAppId, setHoveredAppId] = useState<string | null>(null)
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null)
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const { getPreviewRef } = usePreviewRefs()

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
    if (hoveredAppId) {
      const matching = windows.filter(w => w.appId === hoveredAppId)
      matching.forEach(async win => {
        const el = getPreviewRef(win.id)
        if (el) {
			const canvas = await html2canvas(el, {
				backgroundColor: null,
				removeContainer: true,
				scale: 2, // Aumenta la risoluzione del preview
		  	})
          	setPreviews(prev => ({ ...prev, [win.id]: canvas.toDataURL() }))
        }
      })
    }
  }, [hoveredAppId])

  const extraWindows: Map<string, AppDefinition> = new Map(
    windows
      .filter(win => ![...apps.entries()].some(([id, app]) => id === win.appId && app.isPinned))
      .filter(win => !win.ghost)
      .map(win => [
        win.appId,
        {
          id: win.id,
          name: win.title,
          icon: win.icon || "default-icon.svg",
          component: win.component,
          isPinned: false,
          ghost: win.ghost,
          defaultSize: win.size,
        } as AppDefinition
      ])
  )

  const dockApps: [string, AppDefinition][] = [
    ...[...apps.entries()].filter(([_, app]) => app.isPinned && !app.ghost),
    ...[...extraWindows.entries()]
  ]

  const handleClick = ([id, app]: [string, AppDefinition]) => {
    const matchingWindows = windows.filter(w => w.appId === id)
    const isOpen = matchingWindows.length > 0

    if (!isOpen) {
      openWindow(app, id)
      return
    }

    const isFocused = matchingWindows.filter((w) => w.isFocused).length > 0
    matchingWindows.forEach((w) => {
      if (isFocused) minimizeWindow(w.id)
      else focusWindow(w.id, true)
    })
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
        className={`
          fixed bottom-6 left-1/2 -translate-x-1/2
          bg-white/10 backdrop-blur-lg border border-white/20
          rounded-2xl px-6 py-3 flex gap-6
          shadow-2xl
          z-50
        `}
        style={{ display: windows.filter(w => w.isMaximized).length > 0 ? 'none' : 'flex' }}
      >
        {dockApps.map(([id, app]) => {
          const matchingWindows = windows.filter(w => w.appId === id)
          const isOpen = matchingWindows.length > 0

          return (
            <div
              key={id + nanoid()}
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
                onClick={() => handleClick([id, app])}
                className="
                  relative flex flex-col items-center justify-center gap-1 p-2
                  rounded-lg cursor-pointer
                  transition-transform duration-300 ease-in-out
                  hover:scale-110 hover:brightness-110 dark:hover:brightness-125 active:scale-95
                  hover:drop-shadow-[0_0_15px_rgba(59,130,246,0.7)] dark:hover:drop-shadow-[0_0_15px_rgba(96,165,250,0.9)]
                "
                aria-label={`Apri ${app.name}`}
              >
                <div className="w-12 h-12 flex items-center justify-center text-white rounded-md overflow-hidden">
                  {typeof app.icon === 'string' ? (
                    <img
                      src={`/apps/${app.icon}`}
                      alt={app.name}
                      className="w-10 h-10 rounded-md select-none"
                      draggable={false}
                    />
                  ) : (
                    app.icon
                  )}
                </div>
                {isOpen && (
                  <span
                    className="
                      absolute -bottom-1 left-1/2 -translate-x-1/2
                      w-2 h-2 bg-green-400 rounded-full
                      shadow-[0_0_8px_rgba(34,197,94,0.7)]
                      animate-pulse
                    "
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
                  className="absolute flex gap-1 bottom-20 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-lg border border-white/20 rounded-md shadow-xl z-40 p-2 space-y-2 max-h-50 overflow-y-auto"
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
					{windows.map((win) => win.appId == contextMenu.appId).length > 1 ? "Chiudi tutte le finestre" : "Chiudi finestra"}
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

