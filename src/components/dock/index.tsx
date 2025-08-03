import { useWindowManager } from '@/providers/window-manager'
import { apps } from '@/apps/definitions'
import type { AppDefinition } from '@/types'
import { nanoid } from 'nanoid'
import { useState, useRef, useEffect } from 'react'
import { usePreviewRefs } from "@/providers/preview-refs"
import html2canvas from 'html2canvas-pro'


export const Dock = () => {
	const { windows, openWindow, focusWindow, minimizeWindow, closeWindow } = useWindowManager()
	const [hoveredAppId, setHoveredAppId] = useState<string | null>(null)
	const hoverTimeout = useRef<NodeJS.Timeout | null>(null)
	const [previews, setPreviews] = useState<Record<string, string>>({})
	const { getPreviewRef } = usePreviewRefs()

	useEffect(() => {
		if (hoveredAppId) {
		  const matching = windows.filter(w => w.appId === hoveredAppId)
		  matching.forEach(async win => {
			  const el = getPreviewRef(win.id)
			if (el) {
			  const canvas = await html2canvas(el, { backgroundColor: null })
			  setPreviews(prev => ({ ...prev, [win.id]: canvas.toDataURL() }))
			}
		  })
		}
	  }, [hoveredAppId])

	// Extra windows (non pinned)
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
			if(isFocused) minimizeWindow(w.id)
			else focusWindow(w.id, true)
		})
	}

	return (
		<div
			className="
			fixed bottom-6 left-1/2 -translate-x-1/2
			bg-white/10 backdrop-blur-sm border border-white/10
			rounded-2xl px-6 py-3 flex gap-6
			shadow-2xl
			z-50
			"
			style={{ display: windows.filter((w) => w.isMaximized).length > 0 ? 'none' : 'flex' }}
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
						{/* Hover panel con finestre multiple */}
						{hoveredAppId === id && (
							<div
								onMouseEnter={() => {
									if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
								}}
								onMouseLeave={() => setHoveredAppId(null)}
								className="absolute flex gap-1 bottom-20 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-lg rounded-md shadow-xl z-50 p-2 space-y-2"
							>
								{matchingWindows.length == 0 && <span className="truncate w-full text-center">{app.name}</span>}
								{matchingWindows.map(win => (
									<div
										key={win.id}
										onClick={() => { focusWindow(win.id, true); setHoveredAppId(null)}}
										className="flex flex-col items-center gap-2 px-1 py-1 text-white text-sm hover:bg-white/5 rounded cursor-pointer"
									>
										<div className='relative w-full gap-2 flex' title={win.title || app.name}>
											<span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[150px] w-full text-center">{win.title || app.name}</span>
											<button className=' bg-white/5 px-1.5 rounded-full hover:bg-red-600 cursor-pointer' onClick={() => { closeWindow(win.id);  setHoveredAppId(null)}}>X</button>
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
	)
}
