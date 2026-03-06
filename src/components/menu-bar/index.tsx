import { useEffect, useMemo, useRef, useState } from 'react'
import { useApps } from '@/providers/apps'
import { useSpotlight } from '@/providers/spotlight'
import { useWindowManager } from '@/providers/window-manager'
import { useAuth } from '@/providers/auth'
import { Search } from 'lucide-react'

export const MenuBar = () => {
	const { apps } = useApps()
	const { users, currentUser, isAdmin, createUser, logout } = useAuth()
	const { open } = useSpotlight()
	const { windows, openWindow, focusWindow, minimizeWindow, closeWindow } = useWindowManager()
	const [now, setNow] = useState(() => new Date())
	const [isAppleMenuOpen, setAppleMenuOpen] = useState(false)
	const [isAppMenuOpen, setAppMenuOpen] = useState(false)
	const [isUserMenuOpen, setUserMenuOpen] = useState(false)
	const [newDisplayName, setNewDisplayName] = useState('')
	const [newUsername, setNewUsername] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [newRole, setNewRole] = useState<'admin' | 'user'>('user')
	const [userCreateMessage, setUserCreateMessage] = useState<string | null>(null)
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

	const handleCreateUser = () => {
		const result = createUser({
			displayName: newDisplayName,
			username: newUsername,
			password: newPassword,
			role: newRole,
		})

		if (!result.ok) {
			setUserCreateMessage(result.error ?? 'Errore creazione utente')
			return
		}

		setUserCreateMessage('Utente creato correttamente')
		setNewDisplayName('')
		setNewUsername('')
		setNewPassword('')
		setNewRole('user')
	}

	return (
		<header ref={menuRef} className="absolute top-0 left-0 right-0 z-[110] h-9 px-3 flex items-center justify-between border-b border-white/10 bg-black/25 backdrop-blur-2xl text-white select-none">
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
				<span className="hidden lg:inline truncate max-w-[32vw] opacity-80">{focusedWindow?.title ?? 'Desktop'}</span>
				<div className="relative">
					<button
						onClick={() => {
							setUserMenuOpen((v) => !v)
							setAppleMenuOpen(false)
							setAppMenuOpen(false)
						}}
						className="px-2 py-1 rounded-md hover:bg-white/15 transition"
					>
						{currentUser?.displayName ?? 'Utente'}
					</button>
					{isUserMenuOpen && (
						<div className="absolute right-0 mt-2 w-72 rounded-xl border border-white/20 bg-black/70 backdrop-blur-xl p-1 shadow-2xl">
							<div className="px-3 py-2 text-[11px] uppercase tracking-wider text-white/45">Sessione</div>
							<div className="px-3 pb-2 text-sm text-white/80">{currentUser?.displayName} ({currentUser?.username}) {currentUser?.role === 'admin' ? '• admin' : ''}</div>
							<div className="my-1 h-px bg-white/15" />
							<div className="px-3 py-1 text-[11px] uppercase tracking-wider text-white/45">Utenti disponibili</div>
							{users.map((user) => (
								<div key={user.id} className="w-full text-left px-3 py-1.5 rounded-md text-sm text-white/70">
									{user.displayName} ({user.username}) {user.role === 'admin' ? '• admin' : ''}
								</div>
							))}
							{isAdmin && (
								<>
									<div className="my-1 h-px bg-white/15" />
									<div className="px-3 py-1 text-[11px] uppercase tracking-wider text-white/45">Crea utente (admin)</div>
									<div className="px-3 pb-2 space-y-2">
										<input
											value={newDisplayName}
											onChange={(e) => {
												setNewDisplayName(e.target.value)
												setUserCreateMessage(null)
											}}
											placeholder="Nome visualizzato"
											className="w-full bg-white/10 border border-white/15 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-white/40"
										/>
										<input
											value={newUsername}
											onChange={(e) => {
												setNewUsername(e.target.value)
												setUserCreateMessage(null)
											}}
											placeholder="Username"
											className="w-full bg-white/10 border border-white/15 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-white/40"
										/>
										<input
											type="password"
											value={newPassword}
											onChange={(e) => {
												setNewPassword(e.target.value)
												setUserCreateMessage(null)
											}}
											placeholder="Password"
											className="w-full bg-white/10 border border-white/15 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-white/40"
										/>
										<select
											value={newRole}
											onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
											className="w-full bg-white/10 border border-white/15 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-white/40"
										>
											<option value="user" className="bg-slate-900">Utente standard</option>
											<option value="admin" className="bg-slate-900">Admin</option>
										</select>
										<button onClick={handleCreateUser} className="w-full text-left px-3 py-2 rounded-md hover:bg-white/15 text-sm bg-white/10">
											Crea account
										</button>
										{userCreateMessage && <p className="text-xs text-white/75">{userCreateMessage}</p>}
									</div>
								</>
							)}
							<div className="my-1 h-px bg-white/15" />
							<button onClick={lockAndSwitchUser} className="w-full text-left px-3 py-2 rounded-md hover:bg-white/15 text-sm">Cambia utente / Blocca</button>
						</div>
					)}
				</div>
				<button onClick={open} className="h-6 w-6 grid place-items-center rounded-md hover:bg-white/15 transition" aria-label="Apri Spotlight">
					<Search className="w-3.5 h-3.5" />
				</button>
				<span className="font-medium">{now.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
				<span className="font-semibold tabular-nums">{now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
			</div>
		</header>
	)
}
