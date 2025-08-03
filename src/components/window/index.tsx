import React, { useEffect, useRef, useState } from 'react'
import { useWindowManager } from '@/providers/window-manager'
import { usePreviewRefs } from "@/providers/preview-refs"
import clsx from 'clsx'
import type { WindowInstance } from '@/types'

type ResizeDirection = 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export const Window = ({ window }: { window: WindowInstance }) => {
	const { closeWindow, minimizeWindow, maximizeWindow, focusWindow, resizeWindow, moveWindow } = useWindowManager()
	const { setPreviewRef } = usePreviewRefs()

	const [isClosing, setIsClosing] = useState(false);
	const [isMinimizing, setIsMinimizing] = useState(false);
	

	const ref = useRef<HTMLDivElement>(null)
	const isDragging = useRef(false)
	const offset = useRef({ x: 0, y: 0 })

	useEffect(() => {
		setPreviewRef(window.id, ref.current)
	}, [ref, window, setPreviewRef])

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

		const xPercent = (e.clientX - offset.current.x) / screenWidth * 100
		const yPercent = (e.clientY - offset.current.y) / screenHeight * 100

		moveWindow(window.id, {
			x: Math.max(0, Math.min(xPercent, 100)),
			y: Math.max(0, Math.min(yPercent, 100)),
		})
	}

	const onPointerUp = () => {
		isDragging.current = false
		document.removeEventListener('pointermove', onPointerMove)
		document.removeEventListener('pointerup', onPointerUp)
	}

	const onResize = (e: React.MouseEvent, direction: ResizeDirection) => {
		if (window.isMaximized || window.ghost) return;
		
		e.preventDefault();
		e.stopPropagation();

		focusWindow(window.id, true);

		const startX = e.clientX;
		const startY = e.clientY;

		const screenWidth = document.body.clientWidth;
		const screenHeight = document.body.clientHeight;

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
			const safeY = Math.max(0, Math.min(topPercent, 100 - heightPercent));

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

	if (window.isMinimized) return

	const element = React.createElement(window.component, window.params);

	return (
		<div
			ref={ref}
			className={clsx(
				'absolute ',
				'border border-white/10 shadow-xl backdrop-blur-2xl bg-white/10 overflow-hidden flex flex-col',
				window.isFocused ? 'z-50' : window.ghost ? 'z-60' : 'z-10',
				isClosing && 'animate-close-window',
				isMinimizing && 'animate-minimize-window',
				!window.isMaximized && 'rounded-3xl'
			)}
			
			style={{
				left: window.isMaximized ? 0 : `${window.position.x}%`,
				top: window.isMaximized ? 0 : `${window.position.y}%`,
				width: window.isMaximized ? "100%" : `${window.size.width}%`,
  				height: window.isMaximized ? "100%" : `${window.size.height}%`,
			}}
			
			onClick={() => focusWindow(window.id, true)}
			onAnimationEnd={(e) => {
				if (e.animationName === 'close-window') onCloseAnimationEnd();
				if (e.animationName === 'minimize-window') onMinimizeAnimationEnd();
			}}
		>
		{!window.ghost
			? <div
				className="flex items-center justify-between px-4 py-2 cursor-move select-none bg-black/10 rounded-3xl mx-2 mt-2"
				onPointerDown={onPointerDown}
				>
				<div className="flex-1 flex gap-2 items-center">
					<img className="h-5 w-auto -my-2 -ml-1 select-none" src={`/apps/${window.icon}`} alt={window.title}/>
					<span className="text-sm text-white font-semibold truncate max-w-[75%] ">
						{window.title}
					</span>
				</div>
		
				{/* Bottoni stile macOS */}
				<div className="flex space-x-1.5 ">
				<button
					aria-label="Apri"
					className="w-3.5 h-3.5 rounded-full bg-green-500 hover:bg-green-400 transition-colors duration-200 shadow-md"
					onClick={handleMaximizeClick}
				/>
				<button
					aria-label="Minimizza"
					onClick={handleMinimizeClick}
					className="w-3.5 h-3.5 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors duration-200 shadow-md"
				/>
				<button
					aria-label="Chiudi"
					onClick={handleCloseClick}
					className="w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-400 transition-colors duration-200 shadow-md"
				/>
				</div>
			</div>
			:
			<div
			className="flex items-center justify-between px-4 pt-1 select-none rounded-3xl mx-2 mt-2"
			>
			<div className="flex-1 flex gap-2 items-center">
				<span className="text-sm text-white font-semibold truncate max-w-[75%] ">
					{window.title}
				</span>
			</div>
	
			{/* Bottoni stile macOS */}
			<div className="flex space-x-1.5 ">
			  <button
				aria-label="Chiudi"
				onClick={handleCloseClick}
				className="w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-400 transition-colors duration-200 shadow-md"
			  />
			</div>
			</div>
					
		}
		
	
		  {/* Contenuto */}
		  <div className="flex-1 p-2 overflow-hidden text-white" ref={el => setPreviewRef(window.id, el)} onClick={() => focusWindow(window.id, true)}>{element}</div>
	
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
	</div>);
}
