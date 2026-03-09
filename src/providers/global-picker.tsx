import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useWindowManager } from '@/providers/window-manager'
import { useApps } from '@/providers/apps'
import type { FileItem } from '@/types'

export type GlobalPickerOptions = {
	allow: 'file' | 'folder' | 'disk'
	action?: string
	allowRename?: boolean
	fileExtensions?: string[]
	title?: string
}

export type GlobalPickerResult = {
	path: string
	file: FileItem | null
}

type ActivePicker = {
	requestId: string
	windowId: string
	resolve: (value: GlobalPickerResult | null) => void
	promise: Promise<GlobalPickerResult | null>
}

type GlobalPickerContextType = {
	openPicker: (options: GlobalPickerOptions) => Promise<GlobalPickerResult | null>
	submitPicker: (requestId: string, result: GlobalPickerResult) => void
	cancelPicker: (requestId: string) => void
	activeRequestId: string | null
}

const GlobalPickerContext = createContext<GlobalPickerContextType | null>(null)

export const GlobalPickerProvider = ({ children }: { children: React.ReactNode }) => {
	const { apps } = useApps()
	const { openWindow, closeWindow, focusWindow, windows } = useWindowManager()
	const activeRef = useRef<ActivePicker | null>(null)
	const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
	const focusTimersRef = useRef<number[]>([])

	const clearFocusTimers = useCallback(() => {
		for (const id of focusTimersRef.current) {
			window.clearTimeout(id)
		}
		focusTimersRef.current = []
	}, [])

	const forceFocusWindow = useCallback((windowId: string) => {
		clearFocusTimers()
		focusWindow(windowId, true)
		requestAnimationFrame(() => focusWindow(windowId, true))
		const t1 = window.setTimeout(() => focusWindow(windowId, true), 40)
		const t2 = window.setTimeout(() => focusWindow(windowId, true), 120)
		focusTimersRef.current.push(t1, t2)
	}, [clearFocusTimers, focusWindow])

	const clearActive = useCallback((result: GlobalPickerResult | null) => {
		const active = activeRef.current
		if (!active) return
		active.resolve(result)
		activeRef.current = null
		setActiveRequestId(null)
	}, [])

	const openPicker = useCallback((options: GlobalPickerOptions): Promise<GlobalPickerResult | null> => {
		if (activeRef.current) {
			forceFocusWindow(activeRef.current.windowId)
			return activeRef.current.promise
		}

		for (const windowItem of windows) {
			if (windowItem.appId === 'global-file-picker') {
				closeWindow(windowItem.id)
			}
		}

		const pickerApp = apps.get('global-file-picker')
		if (!pickerApp) return Promise.resolve(null)

		const requestId = `picker-${nanoid()}`
		let resolveFn: (value: GlobalPickerResult | null) => void = () => undefined
		const promise = new Promise<GlobalPickerResult | null>((resolve) => {
			resolveFn = resolve
		})

		const pickerWindow = openWindow(pickerApp, 'global-file-picker', {
			requestId,
            pickerOptions: options,
            focus: true,
		})
		if (!pickerWindow) return Promise.resolve(null)
		forceFocusWindow(pickerWindow.id)

		activeRef.current = {
			requestId,
			windowId: pickerWindow.id,
			resolve: resolveFn,
			promise,
		}
		setActiveRequestId(requestId)
		return promise
	}, [apps, closeWindow, forceFocusWindow, openWindow, windows])

	const submitPicker = useCallback((requestId: string, result: GlobalPickerResult) => {
		const active = activeRef.current
		if (!active || active.requestId !== requestId) return
		closeWindow(active.windowId)
		clearActive(result)
	}, [closeWindow, clearActive])

	const cancelPicker = useCallback((requestId: string) => {
		const active = activeRef.current
		if (!active || active.requestId !== requestId) return
		closeWindow(active.windowId)
		clearActive(null)
	}, [closeWindow, clearActive])

	useEffect(() => {
		const active = activeRef.current
		if (!active) return
		const stillOpen = windows.some((windowItem) => windowItem.id === active.windowId)
		if (!stillOpen) {
			clearActive(null)
			clearFocusTimers()
			return
		}
	}, [windows, clearActive, clearFocusTimers])

	useEffect(() => {
		return () => {
			clearFocusTimers()
		}
	}, [clearFocusTimers])

	const value = useMemo<GlobalPickerContextType>(() => ({
		openPicker,
		submitPicker,
		cancelPicker,
		activeRequestId,
	}), [openPicker, submitPicker, cancelPicker, activeRequestId])

	return <GlobalPickerContext.Provider value={value}>{children}</GlobalPickerContext.Provider>
}

export const useGlobalPicker = () => {
	const ctx = useContext(GlobalPickerContext)
	if (!ctx) throw new Error('useGlobalPicker must be used within GlobalPickerProvider')
	return ctx
}
