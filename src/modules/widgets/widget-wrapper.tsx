import type { WidgetInstance } from '@/types'
import { useWidgetManager } from '@/providers/widget-manager'
import React from 'react';
import { usePersistentStore } from '@/providers/persistent-store';
import { DEFAULT_DESKTOP_SETTINGS, resolveDesktopSettings, type DesktopSettings } from '@/config/system-settings';
import { widgets as widgetDefinitions } from '@/widgets/definitions'

type ResizeEdges = {
	left: boolean
	right: boolean
	top: boolean
	bottom: boolean
}

const EDGE_HIT_SIZE = 8

export const WidgetWrapper = ({ widget }: { widget: WidgetInstance }) => {
	const { removeWidget, getWidgetComponent, moveWidget, resizeWidget, updateWidgetStyle, updateWidgetSettings, updateWidgetSpecificSetting, setWidgetFixed, focusWidget } = useWidgetManager()
	const [storedSettings] = usePersistentStore<DesktopSettings>('gh3sp:settings', DEFAULT_DESKTOP_SETTINGS)
	const settings = resolveDesktopSettings(storedSettings)
	const [showControls, setShowControls] = React.useState(false)
	const [controlsPosition, setControlsPosition] = React.useState<{ top: number; left?: number; right?: number }>({ top: 8, right: 8 })
	const [dragging, setDragging] = React.useState(false)
	const [resizeCursor, setResizeCursor] = React.useState<'default' | 'ew-resize' | 'ns-resize' | 'nwse-resize' | 'nesw-resize'>('default')
	const dragStateRef = React.useRef<{ x: number; y: number; widgetX: number; widgetY: number; width: number; height: number; lockAxis: 'x' | 'y' | null } | null>(null)
	const resizeStateRef = React.useRef<{
		x: number
		y: number
		width: number
		height: number
		widgetX: number
		widgetY: number
		parentWidth: number
		parentHeight: number
		edges: ResizeEdges
	} | null>(null)
	const wrapperRef = React.useRef<HTMLDivElement | null>(null)
	const controlsRef = React.useRef<HTMLDivElement | null>(null)

	const componentType = getWidgetComponent(widget.id)
	const WidgetComponent = componentType
		? React.createElement(componentType as React.ComponentType<Record<string, unknown>>, {
			widgetInstanceId: widget.id,
			widgetSettings: widget.settings?.widgetSpecific ?? {},
		})
		: null

	const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
		if (widget.fixed) return
		event.preventDefault()
		event.stopPropagation()
		const parent = event.currentTarget.closest('[data-widget-layer="true"]') as HTMLElement | null
		if (!parent) return
		focusWidget(widget.id)
		setDragging(true)
		dragStateRef.current = {
			x: event.clientX,
			y: event.clientY,
			widgetX: widget.position.x,
			widgetY: widget.position.y,
			width: parent.clientWidth,
			height: parent.clientHeight,
			lockAxis: null,
		}
		event.currentTarget.setPointerCapture(event.pointerId)
	}

	const onDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
		const drag = dragStateRef.current
		if (!drag) return
		const rawDx = event.clientX - drag.x
		const rawDy = event.clientY - drag.y

		let dx = rawDx
		let dy = rawDy

		if (event.shiftKey) {
			if (!drag.lockAxis && (Math.abs(rawDx) > 3 || Math.abs(rawDy) > 3)) {
				drag.lockAxis = Math.abs(rawDx) >= Math.abs(rawDy) ? 'x' : 'y'
			}
			if (drag.lockAxis === 'x') dy = 0
			if (drag.lockAxis === 'y') dx = 0
		} else {
			drag.lockAxis = null
		}

		const deltaXPercent = (dx / Math.max(1, drag.width)) * 100
		const deltaYPercent = (dy / Math.max(1, drag.height)) * 100
		moveWidget(widget.id, {
			x: drag.widgetX + deltaXPercent,
			y: drag.widgetY + deltaYPercent,
		})
	}

	const stopDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
		if (!dragStateRef.current) return
		dragStateRef.current = null
		setDragging(false)
		event.currentTarget.releasePointerCapture(event.pointerId)
	}

	const resolveResizeEdges = (clientX: number, clientY: number): ResizeEdges => {
		const rect = wrapperRef.current?.getBoundingClientRect()
		if (!rect) return { left: false, right: false, top: false, bottom: false }
		return {
			left: clientX - rect.left <= EDGE_HIT_SIZE,
			right: rect.right - clientX <= EDGE_HIT_SIZE,
			top: clientY - rect.top <= EDGE_HIT_SIZE,
			bottom: rect.bottom - clientY <= EDGE_HIT_SIZE,
		}
	}

	const cursorFromEdges = (edges: ResizeEdges): 'default' | 'ew-resize' | 'ns-resize' | 'nwse-resize' | 'nesw-resize' => {
		if ((edges.left && edges.top) || (edges.right && edges.bottom)) return 'nwse-resize'
		if ((edges.right && edges.top) || (edges.left && edges.bottom)) return 'nesw-resize'
		if (edges.left || edges.right) return 'ew-resize'
		if (edges.top || edges.bottom) return 'ns-resize'
		return 'default'
	}

	const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
		if (widget.fixed) return
		if ((event.target as HTMLElement).closest('[data-widget-controls="true"]')) return
		const edges = resolveResizeEdges(event.clientX, event.clientY)
		const hasResizeEdge = edges.left || edges.right || edges.top || edges.bottom
		if (!hasResizeEdge) return
		event.preventDefault()
		event.stopPropagation()
		const parent = event.currentTarget.closest('[data-widget-layer="true"]') as HTMLElement | null
		if (!parent) return
		focusWidget(widget.id)
		resizeStateRef.current = {
			x: event.clientX,
			y: event.clientY,
			width: widget.size.width,
			height: widget.size.height,
			widgetX: widget.position.x,
			widgetY: widget.position.y,
			parentWidth: parent.clientWidth,
			parentHeight: parent.clientHeight,
			edges,
		}
		event.currentTarget.setPointerCapture(event.pointerId)
	}

	const onResize = (event: React.PointerEvent<HTMLDivElement>) => {
		const resize = resizeStateRef.current
		if (!resize) {
			if ((event.target as HTMLElement).closest('[data-widget-controls="true"]')) {
				setResizeCursor('default')
				return
			}
			setResizeCursor(cursorFromEdges(resolveResizeEdges(event.clientX, event.clientY)))
			return
		}

		event.preventDefault()
		const dx = event.clientX - resize.x
		const dy = event.clientY - resize.y

		let nextWidth = resize.width
		let nextHeight = resize.height
		let nextX = resize.widgetX
		let nextY = resize.widgetY

		if (resize.edges.right) nextWidth = resize.width + dx
		if (resize.edges.bottom) nextHeight = resize.height + dy
		if (resize.edges.left) {
			nextWidth = resize.width - dx
			nextX = resize.widgetX + (dx / Math.max(1, resize.parentWidth)) * 100
		}
		if (resize.edges.top) {
			nextHeight = resize.height - dy
			nextY = resize.widgetY + (dy / Math.max(1, resize.parentHeight)) * 100
		}

		resizeWidget(widget.id, {
			width: nextWidth,
			height: nextHeight,
		})
		moveWidget(widget.id, { x: nextX, y: nextY })
	}

	const stopResize = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!resizeStateRef.current) return
		resizeStateRef.current = null
		setResizeCursor('default')
		event.currentTarget.releasePointerCapture(event.pointerId)
	}

	const onContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
		event.preventDefault()
		event.stopPropagation()
		focusWidget(widget.id)
		const rect = wrapperRef.current?.getBoundingClientRect()
		if (!rect) {
			setShowControls(true)
			return
		}
		const panelWidth = 192
		const panelHeight = 340
		const viewportPadding = 8
		let viewportX = event.clientX + 12
		let viewportY = event.clientY + 12
		if (viewportX + panelWidth > window.innerWidth - viewportPadding) {
			viewportX = event.clientX - panelWidth - 12
		}
		if (viewportY + panelHeight > window.innerHeight - viewportPadding) {
			viewportY = window.innerHeight - panelHeight - viewportPadding
		}
		viewportX = Math.max(viewportPadding, Math.min(window.innerWidth - panelWidth - viewportPadding, viewportX))
		viewportY = Math.max(viewportPadding, Math.min(window.innerHeight - panelHeight - viewportPadding, viewportY))
		const localX = viewportX - rect.left
		const localY = viewportY - rect.top
		setControlsPosition({
			left: localX,
			top: localY,
			right: undefined,
		})
		setShowControls(true)
	}

	React.useEffect(() => {
		if (!showControls) return
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node
			if (!controlsRef.current?.contains(target)) {
				setShowControls(false)
			}
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setShowControls(false)
		}
		document.addEventListener('pointerdown', onPointerDown)
		document.addEventListener('keydown', onKeyDown)
		return () => {
			document.removeEventListener('pointerdown', onPointerDown)
			document.removeEventListener('keydown', onKeyDown)
		}
	}, [showControls])

	const alignCurrentWidget = React.useCallback((alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
		const layer = document.querySelector('[data-widget-layer="true"]') as HTMLElement | null
		const layerWidth = Math.max(1, layer?.clientWidth ?? window.innerWidth)
		const layerHeight = Math.max(1, layer?.clientHeight ?? window.innerHeight)
		const widthPercent = Math.max(10, (widget.size.width / layerWidth) * 100)
		const heightPercent = Math.max(8, (widget.size.height / layerHeight) * 100)

		let nextX = widget.position.x
		let nextY = widget.position.y

		if (alignment === 'left') nextX = 0
		if (alignment === 'center') nextX = Math.max(0, (100 - widthPercent) / 2)
		if (alignment === 'right') nextX = Math.max(0, 100 - widthPercent)

		if (alignment === 'top') nextY = 0
		if (alignment === 'middle') nextY = Math.max(0, (100 - heightPercent) / 2)
		if (alignment === 'bottom') nextY = Math.max(0, 100 - heightPercent)

		moveWidget(widget.id, { x: nextX, y: nextY })
	}, [moveWidget, widget.id, widget.position.x, widget.position.y, widget.size.height, widget.size.width])

	const currentOpacity = widget.style?.opacity ?? 78
	const currentBlur = widget.style?.blur ?? 12
	const currentBorder = widget.style?.border ?? 18
	const borderAlpha = Math.max(0, Math.min(100, currentBorder)) / 100
	const widgetSettings = {
		contentScaleMode: widget.settings?.contentScaleMode ?? 'auto',
		contentScale: widget.settings?.contentScale ?? 100,
		padding: widget.settings?.padding ?? 8,
		widgetSpecific: widget.settings?.widgetSpecific ?? {},
	}
	const specific = widgetSettings.widgetSpecific
	const clock24h = specific.clock24h === false ? false : true
	const clockShowSeconds = specific.clockShowSeconds === true
	const weatherUnit = specific.weatherUnit === 'f' ? 'f' : 'c'
	const weatherWindUnit = specific.weatherWindUnit === 'mph' ? 'mph' : 'kmh'
	const networkIntervalSec = typeof specific.networkIntervalSec === 'number' ? Math.max(2, Math.min(30, Math.round(specific.networkIntervalSec))) : 5
	const contentPadding = Math.max(0, Math.min(24, widgetSettings.padding))
	const widgetDefinition = widgetDefinitions.get(widget.widgetId)
	const baseWidth = Math.max(180, (widgetDefinition?.defaultSize?.width ?? 2) * 120)
	const baseHeight = Math.max(120, (widgetDefinition?.defaultSize?.height ?? 2) * 95)
	const autoScale = Math.max(0.45, Math.min(2.4, Math.min(widget.size.width / baseWidth, widget.size.height / baseHeight)))
	const manualScale = Math.max(0.4, Math.min(2.4, widgetSettings.contentScale / 100))
	const contentScale = widgetSettings.contentScaleMode === 'manual' ? manualScale : autoScale

	return (
		<div
			ref={wrapperRef}
			onPointerDown={() => focusWidget(widget.id)}
			onContextMenu={onContextMenu}
			onPointerDownCapture={startResize}
			onPointerMove={onResize}
			onPointerUp={stopResize}
			onPointerCancel={stopResize}
			className={`rounded-2xl overflow-visible relative w-full h-full group ${settings.widgetsBlur ? 'backdrop-blur-md' : ''}`}
			style={{
				border: `1px solid ${settings.widgetsAccentBorders ? `rgba(125,211,252,${0.5 * borderAlpha})` : `rgba(255,255,255,${0.35 * borderAlpha})`}`,
				boxShadow: `inset 0 1px 0 rgba(255,255,255,${0.08 * borderAlpha}), 0 18px 40px rgba(0,0,0,${0.12 * (currentOpacity / 100)})`,
				cursor: widget.fixed ? 'default' : (dragging ? 'grabbing' : resizeCursor),
			}}
		>
			{showControls && (
				<div
					ref={controlsRef}
					data-widget-controls="true"
					className="absolute z-80 w-48 max-h-[70vh] overflow-y-auto custom-scroll rounded-xl border border-white/10 bg-black/50 backdrop-blur-2xl p-2 pr-1.5 text-[10px] text-white/80 space-y-1.5"
					style={{ top: `${controlsPosition.top}px`, right: controlsPosition.right !== undefined ? `${controlsPosition.right}px` : undefined, left: controlsPosition.left !== undefined ? `${controlsPosition.left}px` : undefined }}
				>
					<div className="flex items-center gap-1.5">
						<button
							onPointerDown={startDrag}
							onPointerMove={onDrag}
							onPointerUp={stopDrag}
							disabled={widget.fixed}
							className={`h-5 px-2 rounded-md border border-white/15 bg-white/10 hover:bg-white/20 text-[10px] cursor-grab active:cursor-grabbing ${dragging ? 'bg-white/25' : ''} disabled:opacity-45 disabled:cursor-not-allowed`}
							title="Sposta"
						>
							⋮⋮
						</button>
						<button
							onClick={() => removeWidget(widget.id)}
							className="h-5 px-2 rounded-md border border-white/15 bg-white/10 hover:bg-rose-400/40 text-[10px]"
							title="Rimuovi"
						>
							×
						</button>
					</div>
					<div className="text-[10px] text-white/80">Allinea questo widget</div>
					<div className="grid grid-cols-3 gap-1">
						<button type="button" onClick={() => alignCurrentWidget('left')} className="h-5 rounded-md border border-white/15 bg-white/10 hover:bg-cyan-400/35" title="Allinea a sinistra">Sx</button>
						<button type="button" onClick={() => alignCurrentWidget('center')} className="h-5 rounded-md border border-white/15 bg-white/10 hover:bg-cyan-400/35" title="Allinea al centro">Ctr</button>
						<button type="button" onClick={() => alignCurrentWidget('right')} className="h-5 rounded-md border border-white/15 bg-white/10 hover:bg-cyan-400/35" title="Allinea a destra">Dx</button>
						<button type="button" onClick={() => alignCurrentWidget('top')} className="h-5 rounded-md border border-white/15 bg-white/10 hover:bg-cyan-400/35" title="Allinea in alto">Top</button>
						<button type="button" onClick={() => alignCurrentWidget('middle')} className="h-5 rounded-md border border-white/15 bg-white/10 hover:bg-cyan-400/35" title="Allinea al centro verticale">Mid</button>
						<button type="button" onClick={() => alignCurrentWidget('bottom')} className="h-5 rounded-md border border-white/15 bg-white/10 hover:bg-cyan-400/35" title="Allinea in basso">Bot</button>
					</div>
					<div className="text-[9px] text-white/55">Tip: mentre trascini, tieni premuto Shift per bloccare il movimento su un asse.</div>
					<div>
						<div className="mb-0.5 text-white/60">Opacità sfondo</div>
						<input
							type="range"
							min={0}
							max={100}
							value={currentOpacity}
							onChange={(event) => updateWidgetStyle(widget.id, { opacity: Number(event.target.value) })}
							className="w-full"
						/>
					</div>
					<div>
						<div className="mb-0.5 text-white/60">Bordo</div>
						<input
							type="range"
							min={0}
							max={100}
							value={currentBorder}
							onChange={(event) => updateWidgetStyle(widget.id, { border: Number(event.target.value) })}
							className="w-full"
						/>
					</div>
					<div>
						<div className="mb-0.5 text-white/60">Scala contenuto</div>
						<div className="flex items-center gap-1 mb-1">
							<button
								type="button"
								onClick={() => updateWidgetSettings(widget.id, { contentScaleMode: 'auto' })}
								className={`px-2 h-5 rounded-md border text-[10px] ${widgetSettings.contentScaleMode === 'auto' ? 'border-cyan-300/50 bg-cyan-400/20' : 'border-white/15 bg-white/10 hover:bg-white/20'}`}
							>
								Auto
							</button>
							<button
								type="button"
								onClick={() => updateWidgetSettings(widget.id, { contentScaleMode: 'manual' })}
								className={`px-2 h-5 rounded-md border text-[10px] ${widgetSettings.contentScaleMode === 'manual' ? 'border-cyan-300/50 bg-cyan-400/20' : 'border-white/15 bg-white/10 hover:bg-white/20'}`}
							>
								Manuale
							</button>
						</div>
						<input
							type="range"
							min={40}
							max={240}
							value={Math.round(widgetSettings.contentScale)}
							disabled={widgetSettings.contentScaleMode !== 'manual'}
							onChange={(event) => updateWidgetSettings(widget.id, { contentScale: Number(event.target.value) })}
							className="w-full disabled:opacity-40"
						/>
					</div>
					<div>
						<div className="mb-0.5 text-white/60">Padding contenuto</div>
						<input
							type="range"
							min={0}
							max={24}
							value={Math.round(contentPadding)}
							onChange={(event) => updateWidgetSettings(widget.id, { padding: Number(event.target.value) })}
							className="w-full"
						/>
					</div>
					<div>
						<label className="flex items-center gap-1.5 text-white/75">
							<input
								type="checkbox"
								checked={Boolean(widget.fixed)}
								onChange={(event) => setWidgetFixed(widget.id, event.target.checked)}
							/>
							Blocca widget
						</label>
					</div>
					<div>
						<div className="mb-0.5 text-white/60">Impostazioni widget</div>
						<div className="rounded-md border border-white/10 bg-white/5 p-1.5 space-y-1.5">
							{widget.widgetId === 'clock' && (
								<>
									<label className="flex items-center justify-between gap-2">
										<span>Formato 24h</span>
										<input
											type="checkbox"
											checked={clock24h}
											onChange={(event) => updateWidgetSpecificSetting(widget.id, 'clock24h', event.target.checked)}
										/>
									</label>
									<label className="flex items-center justify-between gap-2">
										<span>Mostra secondi</span>
										<input
											type="checkbox"
											checked={clockShowSeconds}
											onChange={(event) => updateWidgetSpecificSetting(widget.id, 'clockShowSeconds', event.target.checked)}
										/>
									</label>
								</>
							)}

							{widget.widgetId === 'weather' && (
								<>
									<div className="flex items-center gap-1">
										<button
											type="button"
											onClick={() => updateWidgetSpecificSetting(widget.id, 'weatherUnit', 'c')}
											className={`px-2 h-5 rounded-md border ${weatherUnit === 'c' ? 'border-cyan-300/50 bg-cyan-400/20' : 'border-white/15 bg-white/10 hover:bg-white/20'}`}
										>
											°C
										</button>
										<button
											type="button"
											onClick={() => updateWidgetSpecificSetting(widget.id, 'weatherUnit', 'f')}
											className={`px-2 h-5 rounded-md border ${weatherUnit === 'f' ? 'border-cyan-300/50 bg-cyan-400/20' : 'border-white/15 bg-white/10 hover:bg-white/20'}`}
										>
											°F
										</button>
									</div>
									<div className="flex items-center gap-1">
										<button
											type="button"
											onClick={() => updateWidgetSpecificSetting(widget.id, 'weatherWindUnit', 'kmh')}
											className={`px-2 h-5 rounded-md border ${weatherWindUnit === 'kmh' ? 'border-cyan-300/50 bg-cyan-400/20' : 'border-white/15 bg-white/10 hover:bg-white/20'}`}
										>
											km/h
										</button>
										<button
											type="button"
											onClick={() => updateWidgetSpecificSetting(widget.id, 'weatherWindUnit', 'mph')}
											className={`px-2 h-5 rounded-md border ${weatherWindUnit === 'mph' ? 'border-cyan-300/50 bg-cyan-400/20' : 'border-white/15 bg-white/10 hover:bg-white/20'}`}
										>
											mph
										</button>
									</div>
								</>
							)}

							{widget.widgetId === 'network' && (
								<div>
									<div className="mb-0.5 text-white/60">Intervallo ping ({networkIntervalSec}s)</div>
									<input
										type="range"
										min={2}
										max={30}
										value={networkIntervalSec}
										onChange={(event) => updateWidgetSpecificSetting(widget.id, 'networkIntervalSec', Number(event.target.value))}
										className="w-full"
									/>
								</div>
							)}
						</div>
					</div>
					<div>
						<div className="mb-0.5 text-white/60">Blur</div>
						<input
							type="range"
							min={0}
							max={40}
							value={currentBlur}
							onChange={(event) => updateWidgetStyle(widget.id, { blur: Number(event.target.value) })}
							className="w-full"
						/>
					</div>
				</div>
			)}

			<div className="w-full h-full text-white text-sm select-none overflow-hidden rounded-2xl" style={{ padding: `${contentPadding}px` }}>
				<div
					style={{
						transform: `scale(${contentScale})`,
						transformOrigin: 'top left',
						width: `${100 / contentScale}%`,
						height: `${100 / contentScale}%`,
					}}
				>
					{WidgetComponent}
				</div>
			</div>
		</div>
	)
}
