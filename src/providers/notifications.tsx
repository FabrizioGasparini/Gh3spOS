import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { usePersistentStore } from './persistent-store'
import { DEFAULT_DESKTOP_SETTINGS, type DesktopSettings, resolveDesktopSettings } from '@/config/system-settings'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export type NotificationItem = {
	id: string
	message: string
	type: NotificationType
	createdAt: number
	isRead: boolean
	readAt?: number
	receivedInDoNotDisturb?: boolean
}

type NotificationsContextType = {
	notify: (message: string, type?: NotificationType) => void
	notifications: NotificationItem[]
	unreadCount: number
	markAsRead: (id: string) => void
	markAllAsRead: () => void
	clearNotifications: () => void
	removeNotification: (id: string) => void
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined)

type ToastItem = {
	id: string
	message: string
	type: NotificationType
	createdAt: number
}

const SOUND_PRESETS: Record<NotificationType, { frequencies: number[]; wave: OscillatorType; gain: number; length: number }> = {
	info: { frequencies: [740], wave: 'sine', gain: 0.045, length: 0.09 },
	success: { frequencies: [660, 920], wave: 'triangle', gain: 0.05, length: 0.08 },
	warning: { frequencies: [520, 470], wave: 'square', gain: 0.04, length: 0.1 },
	error: { frequencies: [360, 280], wave: 'sawtooth', gain: 0.055, length: 0.11 },
}

const TYPE_LABELS: Record<NotificationType, string> = {
	info: 'Info',
	success: 'Successo',
	warning: 'Attenzione',
	error: 'Errore',
}

export const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
	const [items, setItems] = useState<ToastItem[]>([])
	const [notifications, setNotifications] = usePersistentStore<NotificationItem[]>('gh3sp:notifications:inbox', [])
	const [storedSettings] = usePersistentStore<DesktopSettings>('gh3sp:settings', DEFAULT_DESKTOP_SETTINGS)
	const settings = useMemo(() => resolveDesktopSettings(storedSettings), [storedSettings])

	const playNotificationSound = useCallback((type: NotificationType) => {
		if (!settings.notificationSound) return
		try {
			const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
			if (!AudioContextClass) return
			const audioContext = new AudioContextClass()
			const preset = SOUND_PRESETS[type]
			const now = audioContext.currentTime

			preset.frequencies.forEach((frequency, index) => {
				const oscillator = audioContext.createOscillator()
				const gain = audioContext.createGain()
				const startAt = now + index * (preset.length + 0.015)
				const stopAt = startAt + preset.length
				oscillator.type = preset.wave
				oscillator.frequency.value = frequency
				gain.gain.setValueAtTime(0.0001, startAt)
				gain.gain.exponentialRampToValueAtTime(preset.gain, startAt + 0.015)
				gain.gain.exponentialRampToValueAtTime(0.0001, stopAt)
				oscillator.connect(gain)
				gain.connect(audioContext.destination)
				oscillator.start(startAt)
				oscillator.stop(stopAt)
			})

			const totalLength = preset.frequencies.length * (preset.length + 0.015) + 0.05
			window.setTimeout(() => {
				audioContext.close().catch(() => undefined)
			}, totalLength * 1000)
		} catch {
			return
		}
	}, [settings.notificationSound])

	const notify = useCallback((message: string, type: NotificationType = 'info') => {
		if (!settings.notificationsEnabled) return
		const id = crypto.randomUUID()
		const createdAt = Date.now()
		const receivedInDoNotDisturb = settings.doNotDisturb
		const previewMessage = settings.notificationsPreview === 'never' ? 'Nuova notifica' : message
		setNotifications(prev => [{ id, message, type, createdAt, isRead: false, receivedInDoNotDisturb }, ...prev])

		if (receivedInDoNotDisturb) return

		setItems(prev => [...prev, { id, message: previewMessage, type, createdAt }])
		playNotificationSound(type)
		setTimeout(() => {
			setItems(prev => prev.filter(item => item.id !== id))
		}, settings.notificationDuration * 1000)
	}, [playNotificationSound, setNotifications, settings.doNotDisturb, settings.notificationDuration, settings.notificationsEnabled, settings.notificationsPreview])

	const markAsRead = useCallback((id: string) => {
		setNotifications(prev => prev.map((item) => item.id === id && !item.isRead
			? { ...item, isRead: true, readAt: Date.now() }
			: item
		))
	}, [setNotifications])

	const markAllAsRead = useCallback(() => {
		const readAt = Date.now()
		setNotifications(prev => prev.map((item) => item.isRead ? item : { ...item, isRead: true, readAt }))
	}, [setNotifications])

	const clearNotifications = useCallback(() => {
		setNotifications([])
	}, [setNotifications])

	const removeNotification = useCallback((id: string) => {
		setNotifications(prev => prev.filter((item) => item.id !== id))
	}, [setNotifications])

	const unreadCount = useMemo(() => notifications.filter((item) => !item.isRead).length, [notifications])

	const value = useMemo(() => ({
		notify,
		notifications,
		unreadCount,
		markAsRead,
		markAllAsRead,
		clearNotifications,
		removeNotification,
	}), [clearNotifications, markAllAsRead, markAsRead, notifications, notify, removeNotification, unreadCount])

	const typeStyles: Record<NotificationType, string> = {
		info: 'border-sky-300/75 bg-sky-500/20 text-sky-50',
		success: 'border-emerald-300/75 bg-emerald-500/20 text-emerald-50',
		warning: 'border-amber-300/80 bg-amber-500/24 text-amber-50',
		error: 'border-rose-300/80 bg-rose-500/24 text-rose-50',
	}

	const typeIcon: Record<NotificationType, React.ReactNode> = {
		info: <Info className="h-4 w-4" />,
		success: <CheckCircle2 className="h-4 w-4" />,
		warning: <AlertTriangle className="h-4 w-4" />,
		error: <XCircle className="h-4 w-4" />,
	}

	const formatToastTime = (timestamp: number) => {
		return new Date(timestamp).toLocaleTimeString('it-IT', {
			hour: '2-digit',
			minute: '2-digit',
		})
	}

	return (
		<NotificationsContext.Provider value={value}>
			{children}
			<div className="fixed top-12 right-4 z-[120] flex w-80 max-w-[90vw] flex-col gap-2 pointer-events-none">
				{items.map((item) => (
					<div
						key={item.id}
						className={`pointer-events-auto rounded-2xl border-l-[4px] px-3 py-2.5 text-sm backdrop-blur-xl shadow-[0_14px_28px_rgba(0,0,0,0.35)] flex items-start gap-2 ${settings.notificationCenterAccentColors && typeStyles[item.type]}`}
					>
						<span className="mt-0.5 opacity-95">{typeIcon[item.type]}</span>
						<div className="min-w-0 flex-1">
							<div className="flex items-center justify-between gap-2">
								<span className="text-[11px] font-semibold uppercase tracking-wider opacity-90">{TYPE_LABELS[item.type]}</span>
								<span className="text-[10px] opacity-80">{formatToastTime(item.createdAt)}</span>
							</div>
							<p className="font-medium leading-snug mt-0.5 truncate">{item.message}</p>
						</div>
					</div>
				))}
			</div>
		</NotificationsContext.Provider>
	)
}

export const useNotifications = () => {
	const ctx = useContext(NotificationsContext)
	if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
	return ctx
}
