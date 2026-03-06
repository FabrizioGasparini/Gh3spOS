import React, { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { nanoid } from 'nanoid'
import type { AppDefinition, SnapBounds, WindowInstance, WindowParamType } from '@/types'
import { usePersistentStore } from './persistent-store'
import { useApps } from './apps'

const MENU_BAR_HEIGHT_PX = 36

const getTopSafePercent = () => {
	if (typeof window === 'undefined') return 0
	return (MENU_BAR_HEIGHT_PX / window.innerHeight) * 100
}

type WindowManagerContextType = {
	windows: WindowInstance[]
	openWindow: (app: AppDefinition, id: string, params?: Record<string, WindowParamType>) => WindowInstance
	openGhostWindow: (title: string, params?: Record<string, WindowParamType>) => WindowInstance
	closeWindow: (id: string) => void
	minimizeWindow: (id: string) => void
	maximizeWindow: (id: string, value?: boolean) => void
	focusWindow: (id: string, value?: boolean) => void
	moveWindow: (id: string, position: { x: number, y: number }) => void
	resizeWindow: (id: string, size: { width: number, height: number }, lock?: boolean) => void
	renameWindow: (id: string, title: string) => void
	getWindowComponent: (id: string) => React.ComponentType<Record<string, unknown>> | null
	snappingEnabled: boolean;
	setSnappingEnabled: (value: boolean) => void;
	snapWindow: (id: string, value: boolean, bounds?: SnapBounds) => void
}

const WindowManagerContext = createContext<WindowManagerContextType | null>(null)

export const useWindowManager = () => {
	const ctx = useContext(WindowManagerContext)

	if (!ctx) throw new Error('useWindowManager must be used within a WindowManagerProvider')
	
	return ctx
}

export const WindowManagerProvider = ({ children }: { children: ReactNode }) => {
	const { apps } = useApps()
	const [windows, setWindows] = usePersistentStore<WindowInstance[]>('windows-manager:windows', [])
	const [snappingEnabled, setSnappingEnabled] = useState(true)

	const resolvedComponents = useMemo(() => {
		const map = new Map<string, React.ComponentType<Record<string, unknown>>>()

		for (const [appId, appDefinition] of apps.entries()) {
			map.set(appId, appDefinition.component)
		}

		return map
	}, [apps])

	const openWindow = (app: AppDefinition, appId: string, params: Record<string, WindowParamType> = {}) => {
		if(app.singleInstance && windows.some(w => w.appId === appId)) {
			const existingWindow = windows.find(w => w.appId === appId)
			if (existingWindow) {
				focusWindow(existingWindow.id, true)
				return existingWindow
			}
		}
		
		const size = { width: app.defaultSize ? app.defaultSize.width : 40, height: app.defaultSize ? app.defaultSize.height : 55 }
		const id = nanoid()
		const topSafePercent = getTopSafePercent()
		params["windowId"] = id
		const newWindow: WindowInstance = { title: app.name, isPinned: app.isPinned, icon: app.icon, appId, params, id, isFocused: true, size, position: {x: Math.max(0, 50 - size.width / 2), y: Math.max(topSafePercent, 50 - size.height / 2)}, isMaximized: false, sizeLocked: false, ghost: app.ghost || false, isSnapped: false }
		setWindows(prev => [...prev.map(w => ({ ...w, isFocused: false })), newWindow])
		return newWindow
	}

	const openGhostWindow = (title: string, params: Record<string, WindowParamType> = {}) => {
		const size = { width: 40, height: 55 }
		const id = nanoid()
		const topSafePercent = getTopSafePercent()
		params["windowId"] = id
		const newWindow: WindowInstance = { title, isPinned: false, icon: "default-icon.svg", appId: "ghost-app", params, id, isFocused: true, size, position: {x: Math.max(0, 50 - size.width / 2), y: Math.max(topSafePercent, 50 - size.height / 2)}, isMaximized: false, sizeLocked: false, ghost: true, isSnapped: false }
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
			prev.map(w => (w.id === id ? { ...w, isMinimized: true, isMaximized: false, isFocused: false, isSnapped: false, snapBounds: undefined } : w))
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
				isSnapped: w.id === id && (value === true || (value === undefined && !w.isMaximized)) ? false : w.isSnapped,
				snapBounds: w.id === id && (value === true || (value === undefined && !w.isMaximized)) ? undefined : w.snapBounds,
				isFocused: w.id === id
			}))
		)
	}

	const moveWindow = (id: string, position: { x: number; y: number }) => {
		const topSafePercent = getTopSafePercent()
		position = {x: Math.max(0, position.x), y: Math.max(topSafePercent, position.y)}
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

	const getWindowComponent = (id: string) => {
		const window = windows.filter((w) => w.id == id).length > 0 ? windows.filter((w) => w.id == id)[0] : null;

		if (!window) return null;

		return resolvedComponents.get(window.appId) ?? null
	}

	const snapWindow = (id: string, value: boolean, bounds?: SnapBounds) => {
		setWindows(windows =>
			windows.map(w => (w.id === id ? { ...w, isSnapped: value, isMaximized: false, snapBounds: value ? bounds : undefined } : w))
		)
	}

	return (
		<WindowManagerContext.Provider value={{ windows, openWindow, openGhostWindow, closeWindow, minimizeWindow, maximizeWindow, focusWindow, moveWindow, resizeWindow, renameWindow, getWindowComponent, snappingEnabled, setSnappingEnabled, snapWindow }}>
			{children}
		</WindowManagerContext.Provider>
	)
}
