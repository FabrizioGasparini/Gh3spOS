import { useEffect, useMemo, useRef, useState } from 'react'
import { useApps } from '@/providers/apps'
import { useSpotlight } from '@/providers/spotlight'
import { useWindowManager } from '@/providers/window-manager'
import { useAuth } from '@/providers/auth'
import { usePersistentStore } from '@/providers/persistent-store'
import { DEFAULT_DESKTOP_SETTINGS, resolveDesktopSettings, type DesktopSettings } from '@/config/system-settings'
import { useNotifications } from '@/providers/notifications'
import { Bell, Lock, Moon, Power, Search, Settings2, Shield, CheckCheck, Trash2 } from 'lucide-react'

export const MenuBar = () => {
	const { apps } = useApps()
	const { currentUser, logout } = useAuth()
	const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications, removeNotification } = useNotifications()
	const [storedSettings, setStoredSettings] = usePersistentStore<DesktopSettings>('gh3sp:settings', DEFAULT_DESKTOP_SETTINGS)
	const desktopSettings = useMemo(() => resolveDesktopSettings(storedSettings), [storedSettings])
	const { open } = useSpotlight()
	const { windows, openWindow, focusWindow, minimizeWindow, closeWindow } = useWindowManager()
	const [now, setNow] = useState(() => new Date())
	const [isAppleMenuOpen, setAppleMenuOpen] = useState(false)
	const [isAppMenuOpen, setAppMenuOpen] = useState(false)
	const [isUserMenuOpen, setUserMenuOpen] = useState(false)
	const [isNotificationsOpen, setNotificationsOpen] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), 1000)
		return () => clearInterval(timer)
	}, [])

	useEffect(() => {
		const onClickOutside = (event: MouseEvent) => {
			if (!menuRef.current?.contains(event.target as Node)) {
				setAppleMenuOpen(false)
				setAppMenuOpen(false)
				setUserMenuOpen(false)
				setNotificationsOpen(false)
			}
		}

		document.addEventListener('mousedown', onClickOutside)
		return () => document.removeEventListener('mousedown', onClickOutside)
	}, [])

	const focusedWindow = useMemo(() => windows.find((w) => w.isFocused), [windows])
	const focusedApp = focusedWindow ? apps.get(focusedWindow.appId) : null

	const openById = (id: string) => {
		const app = apps.get(id)
		if (!app) return

		const existing = windows.find((w) => w.appId === id && !w.isMinimized)
		if (existing) {
			focusWindow(existing.id, true)
			return
		}

		openWindow(app, id)
	}

	const closeAllWindows = () => {
		windows.forEach((win) => closeWindow(win.id))
		setAppleMenuOpen(false)
		setAppMenuOpen(false)
		setUserMenuOpen(false)
		setNotificationsOpen(false)
	}

	const minimizeFocused = () => {
		if (!focusedWindow) return
		minimizeWindow(focusedWindow.id)
		setAppMenuOpen(false)
	}

	const closeFocused = () => {
		if (!focusedWindow) return
		closeWindow(focusedWindow.id)
		setAppMenuOpen(false)
	}

	const lockAndSwitchUser = () => {
		logout()
		setUserMenuOpen(false)
	}

	const menuBarCompact = desktopSettings.menuBarCompact
	const clockShowWeekday = desktopSettings.clockShowWeekday
	const clockUse24h = desktopSettings.clockUse24h
	const clockShowSeconds = desktopSettings.clockShowSeconds
	const locale = desktopSettings.language

	const dateLabel = now.toLocaleDateString(locale, {
		weekday: clockShowWeekday ? 'short' : undefined,
		day: '2-digit',
		month: 'short',
	})

	const timeLabel = now.toLocaleTimeString(locale, {
		hour: '2-digit',
		minute: '2-digit',
		second: clockShowSeconds ? '2-digit' : undefined,
		hour12: !clockUse24h,
	})

	const formatNotificationTime = (timestamp: number) => {
		const date = new Date(timestamp)
		return date.toLocaleTimeString(locale, {
			hour: '2-digit',
			minute: '2-digit',
			hour12: !clockUse24h,
		})
	}

	const toggleDoNotDisturb = () => {
		setStoredSettings((prev) => ({ ...resolveDesktopSettings(prev), doNotDisturb: !desktopSettings.doNotDisturb }))
	}

	const visibleNotifications = notifications.slice(0, desktopSettings.notificationCenterMaxItems)
	const regularNotifications = visibleNotifications.filter((item) => !item.receivedInDoNotDisturb)
	const dndNotifications = visibleNotifications.filter((item) => item.receivedInDoNotDisturb)

	const notificationTypeStyles = {
		info: {
			strong: 'border-sky-300/70 bg-sky-500/18',
			soft: 'border-sky-300/40 bg-sky-500/8',
		},
		success: {
			strong: 'border-emerald-300/70 bg-emerald-500/18',
			soft: 'border-emerald-300/40 bg-emerald-500/8',
		},
		warning: {
			strong: 'border-amber-300/75 bg-amber-500/20',
			soft: 'border-amber-300/45 bg-amber-500/10',
		},
		error: {
			strong: 'border-rose-300/75 bg-rose-500/20',
			soft: 'border-rose-300/45 bg-rose-500/10',
		},
	} as const

	return (
		<header ref={menuRef} className={`absolute top-0 left-0 right-0 z-[110] ${menuBarCompact ? 'h-8' : 'h-9'} px-3 flex items-center justify-between border-b border-white/10 bg-black/25 backdrop-blur-2xl text-white select-none`}>
			<div className="flex items-center gap-2 min-w-0 text-[13px]">
				<button
					onClick={() => {
						setAppleMenuOpen((v) => !v)
						setAppMenuOpen(false)
					}}
					className="text-base leading-none px-2 py-1 rounded-md hover:bg-white/15 transition"
				>
					
				</button>

				{desktopSettings.menuBarShowFocusedApp && (
					<button
						onClick={() => {
							if (!focusedWindow) return
							setAppMenuOpen((v) => !v)
							setAppleMenuOpen(false)
						}}
						disabled={!focusedWindow}
						className="text-xs px-2 py-1 rounded-md hover:bg-white/15 disabled:opacity-50 disabled:hover:bg-transparent transition"
					>
						{focusedApp?.name ?? 'Desktop'}
					</button>
				)}

				{isAppleMenuOpen && (
					<div className="absolute top-10 left-3 w-56 rounded-xl border border-white/20 bg-black/70 backdrop-blur-xl p-1 shadow-2xl">
						<button onClick={() => { open(); setAppleMenuOpen(false) }} className="w-full text-left px-3 py-2 rounded-md hover:bg-white/15 text-sm">Apri Spotlight</button>
						<button onClick={() => { openById('terminal'); setAppleMenuOpen(false) }} className="w-full text-left px-3 py-2 rounded-md hover:bg-white/15 text-sm">Apri Terminal</button>
						<button onClick={() => { openById('settings'); setAppleMenuOpen(false) }} className="w-full text-left px-3 py-2 rounded-md hover:bg-white/15 text-sm">Apri Impostazioni</button>
						<div className="my-1 h-px bg-white/15" />
						<button onClick={closeAllWindows} className="w-full text-left px-3 py-2 rounded-md hover:bg-white/15 text-sm">Chiudi tutte le finestre</button>
					</div>
				)}

				{isAppMenuOpen && focusedWindow && (
					<div className="absolute top-10 left-20 w-56 rounded-xl border border-white/20 bg-black/70 backdrop-blur-xl p-1 shadow-2xl">
						<button onClick={() => { focusWindow(focusedWindow.id, true); setAppMenuOpen(false) }} className="w-full text-left px-3 py-2 rounded-md hover:bg-white/15 text-sm">Porta in primo piano</button>
						<button onClick={minimizeFocused} className="w-full text-left px-3 py-2 rounded-md hover:bg-white/15 text-sm">Minimizza finestra</button>
						<button onClick={closeFocused} className="w-full text-left px-3 py-2 rounded-md hover:bg-white/15 text-sm">Chiudi finestra</button>
					</div>
				)}
			</div>

			<div className="flex items-center gap-2 text-xs">
				{desktopSettings.menuBarShowFocusedApp && <span className="hidden lg:inline truncate max-w-[32vw] opacity-80">{focusedWindow?.title ?? 'Desktop'}</span>}
			
				{desktopSettings.menuBarShowFocusedApp && <span className="w-0.5 h-0.5 ml-2 rounded-full bg-white/70"></span>}
				{desktopSettings.doNotDisturb ? (
					<button className="inline-flex items-center gap-1 rounded-full border border-violet-300/40 bg-violet-500/20 px-2 py-0.5 text-[10px] text-violet-100 hover:bg-violet-500/30 transition" title="Disattiva Non disturbare" onClick={toggleDoNotDisturb}>
						<Moon className="h-3.5 w-3.5" /> N.D.
					</button>
				) : <button className="items-center gap-1 grid place-items-center rounded-full relative h-6 w-6 text-[10px] text-white/20 hover:bg-white/10 transition" title="Attiva Non disturbare" onClick={toggleDoNotDisturb}>
						<Moon className="h-3.5 w-3.5" />
					</button>}
				<div className="relative">
					<button
						onClick={() => {
							setNotificationsOpen((v) => !v)
							setAppleMenuOpen(false)
							setAppMenuOpen(false)
							setUserMenuOpen(false)
						}}
						className="relative h-6 w-6 grid place-items-center rounded-full hover:bg-white/15 transition"
						aria-label="Apri centro notifiche"
					>
						<Bell className="w-3.5 h-3.5" />
						{desktopSettings.notificationCenterShowBadge && unreadCount > 0 && (
							<span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-white text-center font-semibold">
								{unreadCount > 99 ? '99+' : unreadCount}
							</span>
						)}
					</button>
					{isNotificationsOpen && (
						<div className="absolute right-0 mt-2 w-[23rem] rounded-2xl border border-white/25 bg-black/82 backdrop-blur-2xl p-2 shadow-2xl">
							<div className="flex items-center justify-between gap-2 px-2 py-1">
								<div>
									<p className="text-[11px] uppercase tracking-wider text-white/50">Notifiche</p>
									<p className="text-[11px] text-white/70">{unreadCount} non lette · {notifications.length} totali</p>
									{desktopSettings.doNotDisturb && <p className="text-[10px] text-violet-200/90 mt-0.5">Non disturbare attivo</p>}
								</div>
								<div className="flex items-center gap-1.5">
									<button
										onClick={toggleDoNotDisturb}
										className={`rounded-md px-2 py-1 text-[10px] border transition ${desktopSettings.doNotDisturb ? 'border-violet-300/60 bg-violet-500/25 text-violet-100' : 'border-white/20 bg-white/5 text-white/70 hover:bg-white/10'}`}
										title="Attiva o disattiva Non disturbare"
									>
										N.D.
									</button>
									<button onClick={markAllAsRead} className="rounded-md p-1.5 hover:bg-white/10" title="Segna tutte come lette">
										<CheckCheck className="h-3.5 w-3.5 text-white/70" />
									</button>
									<button onClick={clearNotifications} className="rounded-md p-1.5 hover:bg-red-500/20" title="Cancella tutte">
										<Trash2 className="h-3.5 w-3.5 text-red-200" />
									</button>
								</div>
							</div>

							<div className="mt-1 max-h-[26rem] overflow-auto custom-scroll space-y-2 pr-1">
								{visibleNotifications.length === 0 && (
									<div className="px-3 py-6 text-center text-xs text-white/55">Nessuna notifica</div>
								)}

								{regularNotifications.length > 0 && (
									<div className="space-y-1">
										<p className="px-2 text-[10px] uppercase tracking-wider text-white/45">Recenti</p>
										{regularNotifications.map((item) => (
											<div
												key={item.id}
												className={`rounded-lg border-l-[3px] px-2.5 ${desktopSettings.notificationCenterCompact ? 'py-1.5' : 'py-2.5'} ${desktopSettings.notificationCenterAccentColors ? (item.isRead ? notificationTypeStyles[item.type].soft : notificationTypeStyles[item.type].strong) : (item.isRead ? 'border-white/10 bg-white/[0.03]' : 'border-white/25 bg-white/[0.06]')}`}
											>
												<button
													onClick={() => markAsRead(item.id)}
													className="w-full text-left"
												>
													<p className={`${desktopSettings.notificationCenterCompact ? 'text-xs' : 'text-sm'} leading-snug ${item.isRead ? 'text-white/72' : 'text-white'}`}>{item.message}</p>
													<div className="mt-1 flex items-center justify-between gap-2">
														<span className="text-[10px] uppercase tracking-wider text-white/45">{item.type}</span>
														<span className="text-[10px] text-white/45">{formatNotificationTime(item.createdAt)}</span>
													</div>
												</button>
												<div className="mt-0.5 flex justify-end">
													<button onClick={() => removeNotification(item.id)} className="text-[10px] text-white/45 hover:text-white/80">
														Rimuovi
													</button>
												</div>
											</div>
										))}
									</div>
								)}

								{dndNotifications.length > 0 && (
									<div className="space-y-1">
										<p className="px-2 text-[10px] uppercase tracking-wider text-violet-200/85">N.D.</p>
										{dndNotifications.map((item) => (
											<div
												key={item.id}
												className={`rounded-lg border-l-[3px] px-2.5 ${desktopSettings.notificationCenterCompact ? 'py-1.5' : 'py-2.5'} border-violet-300/55 bg-violet-500/10`}
											>
												<button
													onClick={() => markAsRead(item.id)}
													className="w-full text-left"
												>
													<p className={`${desktopSettings.notificationCenterCompact ? 'text-xs' : 'text-sm'} leading-snug ${item.isRead ? 'text-white/72' : 'text-white'}`}>{item.message}</p>
													<div className="mt-1 flex items-center justify-between gap-2">
														<span className="text-[10px] uppercase tracking-wider text-violet-200/85">{item.type} · N.D.</span>
														<span className="text-[10px] text-white/45">{formatNotificationTime(item.createdAt)}</span>
													</div>
												</button>
												<div className="mt-0.5 flex justify-end">
													<button onClick={() => removeNotification(item.id)} className="text-[10px] text-white/45 hover:text-white/80">
														Rimuovi
													</button>
												</div>
											</div>
										))}
									</div>
								)}

								{notifications.length > visibleNotifications.length && (
									<div className="px-2 py-1 text-[10px] text-white/45 text-center">
										Mostrate {visibleNotifications.length} di {notifications.length} notifiche
									</div>
								)}
							</div>
						</div>
					)}
				</div>
				<div className="relative">
					<button
						onClick={() => {
							setUserMenuOpen((v) => !v)
							setAppleMenuOpen(false)
							setAppMenuOpen(false)
							setNotificationsOpen(false)
						}}
						className="px-2 py-1 rounded-md hover:bg-white/15 transition"
					>
						{currentUser?.displayName ?? 'Utente'}
					</button>
					{isUserMenuOpen && (
						<div className="absolute right-0 mt-2 w-80 rounded-2xl border border-white/20 bg-black/80 backdrop-blur-2xl p-2 shadow-2xl">
							<div className="rounded-xl bg-white/5 border border-white/10 px-3 py-3">
								<div className="flex items-center justify-between gap-2">
									<div>
										<p className="text-[11px] uppercase tracking-wider text-white/50">Sessione attiva</p>
										<p className="text-sm font-medium text-white/90">{currentUser?.displayName ?? 'Utente'}</p>
										<p className="text-xs text-white/60">@{currentUser?.username}</p>
									</div>
									{currentUser?.role === 'admin' && (
										<span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-400/15 px-2 py-0.5 text-[10px] text-emerald-100">
											<Shield className="h-3 w-3" /> Admin
										</span>
									)}
								</div>
							</div>

							<button
								onClick={() => {
									openById('settings')
									setUserMenuOpen(false)
								}}
								className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg hover:bg-white/10 text-sm"
							>
								<Settings2 className="h-4 w-4 text-white/70" />
								Account e impostazioni
							</button>
							<button onClick={lockAndSwitchUser} className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg hover:bg-white/10 text-sm">
								<Lock className="h-4 w-4 text-white/70" />
								Blocca e cambia utente
							</button>
							<button onClick={lockAndSwitchUser} className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg hover:bg-red-500/20 text-sm text-red-200">
								<Power className="h-4 w-4" />
								Esci dalla sessione
							</button>
						</div>
					)}
				</div>
				<button onClick={open} className="h-6 w-6 grid place-items-center rounded-md hover:bg-white/15 transition" aria-label="Apri Spotlight">
					<Search className="w-3.5 h-3.5" />
				</button>
				<span className="font-medium capitalize">{dateLabel}</span>
				<span className="font-semibold tabular-nums">{timeLabel}</span>
			</div>
		</header>
	)
}
