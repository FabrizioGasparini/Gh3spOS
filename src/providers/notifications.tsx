import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type NotificationItem = {
	id: string
	message: string
	type?: 'info' | 'success' | 'warning' | 'error'
}

type NotificationsContextType = {
	notify: (message: string, type?: NotificationItem['type']) => void
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined)

export const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
	const [items, setItems] = useState<NotificationItem[]>([])

	const notify = useCallback((message: string, type: NotificationItem['type'] = 'info') => {
		const id = crypto.randomUUID()
		setItems(prev => [...prev, { id, message, type }])
		setTimeout(() => {
			setItems(prev => prev.filter(item => item.id !== id))
		}, 3500)
	}, [])

	const value = useMemo(() => ({ notify }), [notify])

	return (
		<NotificationsContext.Provider value={value}>
			{children}
			<div className="fixed top-12 right-4 z-[120] flex w-80 max-w-[90vw] flex-col gap-2 pointer-events-none">
				{items.map((item) => (
					<div
						key={item.id}
						className="pointer-events-auto rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white backdrop-blur-xl shadow-xl"
					>
						<span className="font-medium">{item.message}</span>
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
