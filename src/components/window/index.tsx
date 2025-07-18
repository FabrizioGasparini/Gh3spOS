import React, { useEffect, useRef, useState } from 'react'
import { useWindowManager } from '@/providers/window-manager'
import { usePreviewRefs } from "@/providers/preview-refs"
import clsx from 'clsx'
import type { WindowInstance } from '@/types'

export const Window = ({ window }: { window: WindowInstance }) => {
	const { closeWindow, minimizeWindow, maximizeWindow, focusWindow, resizeWindow, moveWindow } = useWindowManager()
	const { setPreviewRef } = usePreviewRefs()

	const [isClosing, setIsClosing] = useState(false);
	const [isMinimizing, setIsMinimizing] = useState(false);
	const [isMaximizing, setIsMaximizing] = useState(false);

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

	const onResize = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
	  
		focusWindow(window.id, true)
	  
		const startX = e.clientX
		const startY = e.clientY
	  
		const screenWidth = document.body.clientWidth
		const screenHeight = document.body.clientHeight
	  
		const startWidth = (window.size.width / 100) * screenWidth
		const startHeight = (window.size.height / 100) * screenHeight
	  
		const onMouseMove = (e: MouseEvent) => {
		  maximizeWindow(window.id, false)
	  
		  const deltaX = e.clientX - startX
		  const deltaY = e.clientY - startY
	  
		  const newWidth = Math.max(200, startWidth + deltaX)
		  const newHeight = Math.max(100, startHeight + deltaY)
	  
		  const widthPercent = (newWidth / screenWidth) * 100
		  const heightPercent = (newHeight / screenHeight) * 100
	  
		  resizeWindow(window.id, {
			width: Math.min(widthPercent, 100),
			height: Math.min(heightPercent, 100),
		  })
		}
	  
		const onMouseUp = () => {
		  document.removeEventListener('mousemove', onMouseMove)
		  document.removeEventListener('mouseup', onMouseUp)
		}
	  
		document.addEventListener('mousemove', onMouseMove)
		document.addEventListener('mouseup', onMouseUp)
	  }
	  

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
		setIsMaximizing(true);
		maximizeWindow(window.id)
	};

	if (window.isMinimized) return

	const element = React.createElement(window.component, window.params);

	return (
		<div
			ref={ref}
			className={clsx(
				'absolute dark:bg-gray-900/80',
				'backdrop-blur-lg border border-white/30 dark:border-gray-700/50 overflow-hidden flex flex-col',
				window.isFocused ? 'z-50' : 'z-10',
				isClosing && 'animate-close-window',
				isMinimizing && 'animate-minimize-window',
				!window.isMaximized && 'rounded-xl'
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
		<div
			className="flex items-center justify-between px-4 py-2 cursor-move select-none bg-gray-900/50"
			onPointerDown={onPointerDown}
		>
			<span className="text-sm text-white font-semibold truncate max-w-[75%] ">
				{window.title}
			</span>
	
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
	
		  {/* Contenuto */}
		  <div className="flex-1 p-4 overflow-hidden text-white" ref={el => setPreviewRef(window.id, el)} onClick={() => focusWindow(window.id, true)}>{element}</div>
	
		  {/* Angolo per il resize invisibile */}
		  <div
			className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize"
			onMouseDown={onResize}
			style={{ userSelect: 'none' }}
		  />
		</div>
	  );
}
