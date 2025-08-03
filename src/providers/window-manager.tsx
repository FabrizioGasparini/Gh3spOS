import React, { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { nanoid } from 'nanoid'
import type { AppDefinition, WindowInstance, WindowParamType } from '@/types'


type WindowManagerContextType = {
	windows: WindowInstance[]
	openWindow: (app: AppDefinition, id: string, params?: Record<string, WindowParamType>) => WindowInstance
	openGhostWindow: (title: string, component: React.FC<any>, params?: Record<string, WindowParamType>) => WindowInstance
	closeWindow: (id: string) => void
	minimizeWindow: (id: string) => void
	maximizeWindow: (id: string, value?: boolean) => void
	focusWindow: (id: string, value?: boolean) => void
	moveWindow: (id: string, position: { x: number, y: number }) => void
	resizeWindow: (id: string, size: { width: number, height: number }, lock?: boolean) => void
	renameWindow: (id: string, title: string) => void
}

const WindowManagerContext = createContext<WindowManagerContextType | null>(null)

export const useWindowManager = () => {
	const ctx = useContext(WindowManagerContext)
	if (!ctx) throw new Error('useWindowManager must be used within a WindowManagerProvider')
	return ctx
}

export const WindowManagerProvider = ({ children }: { children: ReactNode }) => {
	const [windows, setWindows] = useState<WindowInstance[]>([])

	const openWindow = (app: AppDefinition, appId: string, params: Record<string, WindowParamType> = {}) => {
		const size = { width: app.defaultSize ? app.defaultSize.width : 40, height: app.defaultSize ? app.defaultSize.height : 55 }
		const id = nanoid()
		params["windowId"] = id
		const newWindow: WindowInstance = { title: app.name, isPinned: app.isPinned, icon: app.icon, component: app.component, appId, params, id, isFocused: true, size, position: {x: Math.max(0, 50 - size.width / 2), y: Math.max(0, 50 - size.height / 2)}, isMaximized: false, sizeLocked: false, ghost: app.ghost || false }
		setWindows(prev => [...prev.map(w => ({ ...w, isFocused: false })), newWindow])
		return newWindow
	}

	const openGhostWindow = (title: string, component: React.FC<any>, params: Record<string, WindowParamType> = {}) => {
		const size = { width: 40, height: 55 }
		const id = nanoid()
		params["windowId"] = id
		const windowComponent: React.FC = () => (
			<div className="w-full h-full p-3 text-white custom-scroll relative">
				{React.createElement(component, { ...params, windowId: id })}
			</div>
		)
		const newWindow: WindowInstance = { title, isPinned: false, icon: "default-icon.svg", component: windowComponent, appId: "ghost-app", params, id, isFocused: true, size, position: {x: Math.max(0, 50 - size.width / 2), y: Math.max(0, 50 - size.height / 2)}, isMaximized: false, sizeLocked: false, ghost: true }
		setWindows(prev => [...prev.map(w => ({ ...w, isFocused: false })), newWindow])
		return newWindow
	}

	const closeWindow = (id: string) => {
		setWindows((prev) =>
			prev.filter((w) => w.id !== id)
		)
	}

	const minimizeWindow = (id: string) => {
		setWindows(prev =>
			prev.map(w => (w.id === id ? { ...w, isMinimized: true, isFocused: false } : w))
		)
	}

	const focusWindow = (id: string, value?: boolean) => {
		setWindows(prev =>
			prev.map(w => ({
				...w,
				isFocused:
					w.id === id
						? value == undefined
							? !w.isFocused
							: value
						: false,
				isMinimized:
					w.id === id
						? value == true || value == undefined && !w.isFocused
							? false
							: w.isMinimized
						: w.isMinimized
			}))
		)
	}

	const maximizeWindow = (id: string, value?: boolean) => {
		setWindows(prev =>
			prev.map(w => ({
				...w,
				isMaximized:
					w.id === id
						? value == undefined
							? !w.isMaximized
							: value
						: w.isMaximized,
				isFocused: w.id === id
			}))
		)
	}

	const moveWindow = (id: string, position: { x: number; y: number }) => {
		position = {x: Math.max(0, position.x), y: Math.max(0, position.y)}
		setWindows(windows =>
			windows.map(w => (w.id === id ? { ...w, position, isFocused: true } : w))
		)
	}
	
	const resizeWindow = (id: string, size: { width: number; height: number }, lock?: boolean) => {

		windows.filter((w) => {
			if (w.id == id) {
				if (w.sizeLocked) {
					size.height = size.width * w.size.height / w.size.width; 
				}
			} 
		})

		setWindows(windows =>
			windows.map(w => (w.id === id ? { ...w, size, sizeLocked: lock || w.sizeLocked } : w))
		)
	}	

	const renameWindow = (id: string, title: string) => {
		setWindows(windows => 
			windows.map(w => (w.id == id ? {...w, title} : w))
		)
	}
	return (
		<WindowManagerContext.Provider value={{ windows, openWindow, openGhostWindow, closeWindow, minimizeWindow, maximizeWindow, focusWindow, moveWindow, resizeWindow, renameWindow }}>
			{children}
		</WindowManagerContext.Provider>
	)
}
