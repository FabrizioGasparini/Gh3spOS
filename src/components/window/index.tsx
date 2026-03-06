import React, { useEffect, useRef, useState } from 'react'
import { useWindowManager } from '@/providers/window-manager'
import { usePreviewRefs } from "@/providers/preview-refs"
import clsx from 'clsx'
import type { SnapBounds, WindowInstance } from '@/types'

type ResizeDirection = 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const SNAP_THRESHOLD = 50 //px
const MENU_BAR_HEIGHT_PX = 36


export const Window = ({ window }: { window: WindowInstance }) => {
	const { closeWindow, minimizeWindow, maximizeWindow, focusWindow, resizeWindow, moveWindow, getWindowComponent, snappingEnabled, snapWindow } = useWindowManager()
	const { setPreviewRef } = usePreviewRefs()
	const [ snappingPosition, setSnappingPosition ] = useState<{width: number, height: number, x: number, y: number} | null>(null)

	const [isClosing, setIsClosing] = useState(false);
	const [isMinimizing, setIsMinimizing] = useState(false);
	

	const ref = useRef<HTMLDivElement>(null)
	const isDragging = useRef(false)
	const offset = useRef({ x: 0, y: 0 })
	const getTopSafePercent = (screenHeight: number) => (MENU_BAR_HEIGHT_PX / screenHeight) * 100

	const getSnapTarget = (x: number, y: number, screenWidth: number, screenHeight: number): { maximize: boolean; bounds?: SnapBounds } | null => {
		const topSafePercent = getTopSafePercent(screenHeight)
		const availableHeight = 100 - topSafePercent

		if (x < SNAP_THRESHOLD && y < SNAP_THRESHOLD + MENU_BAR_HEIGHT_PX) return { maximize: false, bounds: { width: 50, height: availableHeight / 2, x: 0, y: topSafePercent } }
		if (x > screenWidth - SNAP_THRESHOLD && y < SNAP_THRESHOLD + MENU_BAR_HEIGHT_PX) return { maximize: false, bounds: { width: 50, height: availableHeight / 2, x: 50, y: topSafePercent } }
		if (x < SNAP_THRESHOLD && y > screenHeight - SNAP_THRESHOLD) return { maximize: false, bounds: { width: 50, height: availableHeight / 2, x: 0, y: topSafePercent + availableHeight / 2 } }
		if (x > screenWidth - SNAP_THRESHOLD && y > screenHeight - SNAP_THRESHOLD) return { maximize: false, bounds: { width: 50, height: availableHeight / 2, x: 50, y: topSafePercent + availableHeight / 2 } }
		if (x < SNAP_THRESHOLD) return { maximize: false, bounds: { width: 50, height: availableHeight, x: 0, y: topSafePercent } }
		if (x > screenWidth - SNAP_THRESHOLD) return { maximize: false, bounds: { width: 50, height: availableHeight, x: 50, y: topSafePercent } }
		if (y < SNAP_THRESHOLD + MENU_BAR_HEIGHT_PX) return { maximize: true }
		return null
	}

	useEffect(() => {
		setPreviewRef(window.id, ref.current)
	}, [window.id, setPreviewRef])

	const onPointerDown = (e: React.PointerEvent) => {
		isDragging.current = true
		focusWindow(window.id, true)

		const screenWidth = document.body.clientWidth
		const screenHeight = document.body.clientHeight
	  
		const startX = (window.position.x / 100) * screenWidth
		const startY = (window.position.y / 100) * screenHeight
		
		offset.current = {
			x: e.clientX - startX,
			y: e.clientY - startY,
		}
		document.addEventListener('pointermove', onPointerMove)
		document.addEventListener('pointerup', onPointerUp)
	}

	const onPointerMove = (e: PointerEvent) => {
		if (!isDragging.current || !ref.current) return

		if(Math.abs(offset.current.x + window.position.x - e.clientX) == 0 || Math.abs(offset.current.y + window.position.y - e.clientY) == 0) return

		const screenWidth = document.body.clientWidth
		const screenHeight = document.body.clientHeight
		const topSafePercent = getTopSafePercent(screenHeight)

		const xPercent = (e.clientX - offset.current.x) / screenWidth * 100
		const yPercent = (e.clientY - offset.current.y) / screenHeight * 100

		if (window.isMaximized || window.isSnapped) {
			maximizeWindow(window.id, false)
			snapWindow(window.id, false)
			setSnappingPosition(null)
			
			const x = (e.clientX / screenWidth * 100) - (window.size.width * e.clientX / screenWidth)
			const y = (e.clientY) / screenHeight * 100
			moveWindow(window.id, {
				x: Math.max(0, Math.min(x, 100)),
				y: Math.max(topSafePercent, Math.min(y, 100)),
			})
		}
		else
			moveWindow(window.id, {
				x: Math.max(0, Math.min(xPercent, 100)),
				y: Math.max(topSafePercent, Math.min(yPercent, 100)),
			})


		
		const target = getSnapTarget(e.clientX, e.clientY, screenWidth, screenHeight)
		setSnappingPosition(target?.maximize ? { width: 100, height: 100 - topSafePercent, x: 0, y: topSafePercent } : target?.bounds ?? null)
	}

	const onPointerUp = (e: PointerEvent) => {
		isDragging.current = false
		document.removeEventListener('pointermove', onPointerMove)
		document.removeEventListener('pointerup', onPointerUp)

		if (!snappingEnabled) {
			setSnappingPosition(null)
			return
		}

		const screenWidth = document.body.clientWidth
		const screenHeight = document.body.clientHeight
		const target = getSnapTarget(e.clientX, e.clientY, screenWidth, screenHeight)

		if (!target) {
			setSnappingPosition(null)
			return
		}

		if (target.maximize) {
			snapWindow(window.id, false)
			maximizeWindow(window.id, true)
			setSnappingPosition(null)
			return
		}

		maximizeWindow(window.id, false)
		snapWindow(window.id, true, target.bounds)
		setSnappingPosition(null)
	}

	const onResize = (e: React.MouseEvent, direction: ResizeDirection) => {
		if (window.isMaximized || window.isSnapped || window.ghost) return;
		
		e.preventDefault();
		e.stopPropagation();

		focusWindow(window.id, true);

		const startX = e.clientX;
		const startY = e.clientY;

		const screenWidth = document.body.clientWidth;
		const screenHeight = document.body.clientHeight;
		const topSafePercent = getTopSafePercent(screenHeight)

		const startWidth = (window.size.width / 100) * screenWidth;
		const startHeight = (window.size.height / 100) * screenHeight;

		const startLeft = (window.position.x / 100) * screenWidth;
		const startTop = (window.position.y / 100) * screenHeight;

		const onMouseMove = (e: MouseEvent) => {
			maximizeWindow(window.id, false);

			const deltaX = e.clientX - startX;
			const deltaY = e.clientY - startY;

			let newWidth = startWidth;
			let newHeight = startHeight;
			let newLeft = startLeft;
			let newTop = startTop;

			// Orizzontale
			if (direction.includes('right')) {
				newWidth = Math.max(200, startWidth + deltaX);
			} else if (direction.includes('left')) {
				newWidth = Math.max(200, startWidth - deltaX);
				newLeft = startLeft + deltaX;
			}

			// Verticale
			if (direction.includes('bottom')) {
				newHeight = Math.max(100, startHeight + deltaY);
			} else if (direction.includes('top')) {
				newHeight = Math.max(100, startHeight - deltaY);
				newTop = startTop + deltaY;
			}

			// Converti in %
			const widthPercent = (newWidth / screenWidth) * 100;
			const heightPercent = (newHeight / screenHeight) * 100;
			const leftPercent = (newLeft / screenWidth) * 100;
			const topPercent = (newTop / screenHeight) * 100;

			// Limita allo schermo
			const safeX = Math.max(0, Math.min(leftPercent, 100 - widthPercent));
			const safeY = Math.max(topSafePercent, Math.min(topPercent, 100 - heightPercent));

			resizeWindow(window.id, {
				width: Math.min(widthPercent, 100),
				height: Math.min(heightPercent, 100),
			});

			moveWindow(window.id, {
				x: safeX,
				y: safeY,
			});
		};

		const onMouseUp = () => {
			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseup', onMouseUp);
		};

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	};
	  

	const onCloseAnimationEnd = () => {
		if (isClosing) {
		  closeWindow(window.id); 
		}
	  };
	
	  const onMinimizeAnimationEnd = () => {
		if (isMinimizing) {
		  minimizeWindow(window.id); 
		  setIsMinimizing(false);
		}
	  };
	
	const handleCloseClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		e.stopPropagation();
		setIsClosing(true);
	};
	
	const handleMinimizeClick = (e?: React.MouseEvent<HTMLButtonElement>) => {
		if(e) e.stopPropagation();
		setIsMinimizing(true);
	};

	const handleMaximizeClick = (e?: React.MouseEvent<HTMLButtonElement>) => {
		if(e) e.stopPropagation();
		maximizeWindow(window.id)
	};

	if (window.isMinimized) return null

	const component = getWindowComponent(window.id)
	if (!component) return null

	const element = React.createElement(component, window.params);
	const menuBarPercent = getTopSafePercent(document.body.clientHeight)
	const isHeaderOverlay = window.isMaximized && !window.ghost

	return (
		<>	
			{snappingPosition && !window.isSnapped && <div className="absolute top-0 left-0 backdrop-blur-3xl bg-cyan-300/20 m-1 rounded-3xl border border-cyan-100/40 shadow-[0_0_35px_rgba(34,211,238,0.25)]"
				style={{ width: `${snappingPosition.width}%`, height: `${snappingPosition.height}%`, left: `${snappingPosition.x}%`, top: `${snappingPosition.y}%`}}
			></div>}
			<div
				ref={ref}
				className={clsx(
					'absolute ',
					'group/window overflow-hidden flex flex-col transition-[box-shadow,filter,border-color,background-color] duration-200 border',
					window.isFocused
						? 'border-white/30 bg-black/10 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl'
						: 'border-white/18 bg-black/6 shadow-[0_12px_30px_rgba(0,0,0,0.32)] backdrop-blur-xl',
					window.isFocused ? 'z-50' : 'z-10',
					isClosing && 'animate-close-window',
					isMinimizing && 'animate-minimize-window',
					!window.isMaximized && !window.isSnapped && 'rounded-2xl'
				)}
				
				style={{
					left: window.isMaximized ? 0 : window.isSnapped && window.snapBounds ? `${window.snapBounds.x}%` : `${window.position.x}%`,
					top: window.isMaximized ? `${menuBarPercent}%` : window.isSnapped && window.snapBounds ? `${window.snapBounds.y}%` : `${window.position.y}%`,
					width: window.isMaximized ? "100%" : window.isSnapped && window.snapBounds ? `${window.snapBounds.width}%` : `${window.size.width}%`,
					height: window.isMaximized ? `${100 - menuBarPercent}%` : window.isSnapped && window.snapBounds ? `${window.snapBounds.height}%` : `${window.size.height}%`,
				}}
				
				onClick={() => focusWindow(window.id, true)}
				onPointerDownCapture={() => focusWindow(window.id, true)}
				role="dialog"
				aria-label={window.title}
				onAnimationEnd={(e) => {
					if (e.animationName === 'close-window') onCloseAnimationEnd();
					if (e.animationName === 'minimize-window') onMinimizeAnimationEnd();
				}}
			>
			{isHeaderOverlay && (
				<div className="peer/titlebar-hotspot absolute left-0 right-0 top-0 z-20 h-3" />
			)}
			{!window.ghost
				? <div
					className={clsx(
						"flex items-center justify-between px-3 py-1.5 cursor-move select-none border-b",
						window.isFocused ? "bg-black/25 border-white/15" : "bg-black/28 border-white/10",
						isHeaderOverlay && "absolute left-0 right-0 top-0 z-30 opacity-0 -translate-y-2 pointer-events-none transition-all duration-200 peer-hover/titlebar-hotspot:opacity-100 peer-hover/titlebar-hotspot:translate-y-0 peer-hover/titlebar-hotspot:pointer-events-auto hover:opacity-100 hover:translate-y-0 hover:pointer-events-auto group-focus-within/window:opacity-100 group-focus-within/window:translate-y-0 group-focus-within/window:pointer-events-auto"
					)}
					onPointerDown={onPointerDown}
					>
					<div className="flex-1 flex gap-2 items-center min-w-0">
						<img className="h-4 w-4 rounded-sm select-none" src={`/apps/${window.icon}`} alt={window.title}/>
						<span className={clsx(
							"text-[13px] truncate",
							window.isFocused ? "text-white font-semibold" : "text-white/85 font-medium"
						)}>
							{window.title}
						</span>
					</div>
			
					<div className="flex space-x-1.5 ml-3">
					<button
						aria-label="Massimizza"
						className="w-3.5 h-3.5 rounded-full bg-emerald-500/95 hover:bg-emerald-400 transition-all duration-150 shadow-[0_0_10px_rgba(16,185,129,0.45)]"
						onClick={handleMaximizeClick}
					/>
					<button
						aria-label="Minimizza"
						onClick={handleMinimizeClick}
						className="w-3.5 h-3.5 rounded-full bg-amber-400/95 hover:bg-amber-300 transition-all duration-150 shadow-[0_0_10px_rgba(250,204,21,0.45)]"
					/>
					<button
						aria-label="Chiudi"
						onClick={handleCloseClick}
						className="w-3.5 h-3.5 rounded-full bg-rose-500/95 hover:bg-rose-400 transition-all duration-150 shadow-[0_0_10px_rgba(244,63,94,0.45)]"
					/>
					</div>
				</div>
				:
				<div
				className="flex items-center justify-between px-3 py-1.5 select-none bg-black/25 border-b border-white/10"
				>
				<div className="flex-1 flex gap-2 items-center min-w-0">
					<span className="text-sm text-white/90 font-medium truncate max-w-[75%] ">
						{window.title}
					</span>
				</div>
		
				<div className="flex space-x-1.5 ">
				<button
					aria-label="Chiudi"
					onClick={handleCloseClick}
					className="w-3.5 h-3.5 rounded-full bg-rose-500/95 hover:bg-rose-400 transition-all duration-150"
				/>
				</div>
				</div>
						
			}
			
			{/* Contenuto */}
			<div className="flex-1 overflow-hidden text-white bg-transparent" ref={el => setPreviewRef(window.id, el)} onClick={() => focusWindow(window.id, true)} onMouseDownCapture={() => focusWindow(window.id, true)}>
				<div className="w-full h-full">{element}</div>
			</div>
		
			{/* Angolo per il resize invisibile */}
				{!window.ghost && <>
					{/* Bordi */}
					<div onMouseDown={(e) => onResize(e, 'left')} className="absolute top-0 left-0 w-2 h-full cursor-ew-resize z-10" />
					<div onMouseDown={(e) => onResize(e, 'right')} className="absolute top-0 right-0 w-2 h-full cursor-ew-resize z-10" />
					<div onMouseDown={(e) => onResize(e, 'top')} className="absolute top-0 left-0 w-full h-2 cursor-ns-resize z-10" />
					<div onMouseDown={(e) => onResize(e, 'bottom')} className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize z-10" />

					{/* Angoli */}
					<div onMouseDown={(e) => onResize(e, 'top-left')} className="absolute top-0 left-0 w-2 h-2 cursor-nwse-resize z-10" />
					<div onMouseDown={(e) => onResize(e, 'top-right')} className="absolute top-0 right-0 w-2 h-2 cursor-nesw-resize z-10" />
					<div onMouseDown={(e) => onResize(e, 'bottom-left')} className="absolute bottom-0 left-0 w-2 h-2 cursor-nesw-resize z-10" />
					<div onMouseDown={(e) => onResize(e, 'bottom-right')} className="absolute bottom-0 right-0 w-2 h-2 cursor-nwse-resize z-10" />
				</>}
			</div>
		</>
	);
}
