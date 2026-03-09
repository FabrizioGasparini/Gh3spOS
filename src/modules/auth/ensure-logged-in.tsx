import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/providers/auth'
import { AnimatePresence, motion } from 'framer-motion'

const DEFAULT_AVATAR = (
	<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-white/80">
		<circle cx="12" cy="8" r="4" fill="currentColor" fillOpacity="0.5" />
		<path
			d="M4 18C4 13.5817 7.58172 10 12 10C16.4183 10 20 13.5817 20 18V20H4V18Z"
			fill="currentColor"
			fillOpacity="0.5"
		/>
	</svg>
)

export const EnsureLoggedIn = ({ children }: { children: React.ReactNode }) => {
	const { isAuthenticated, users, login } = useAuth()
	const [selectedUsername, setSelectedUsername] = useState(users[0]?.username ?? '')
	const [password, setPassword] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [isLoggingIn, setIsLoggingIn] = useState(false)
	const [accessStage, setAccessStage] = useState<'lock' | 'login' | 'auth' | 'granted' | 'booting'>('lock')
	const [allowDesktopRender, setAllowDesktopRender] = useState(false)
	const [now, setNow] = useState(() => new Date())

	useEffect(() => {
		if (users.length && !users.some((u) => u.username === selectedUsername)) {
			setSelectedUsername(users[0].username)
		}
	}, [users, selectedUsername])

	useEffect(() => {
		const timer = window.setInterval(() => setNow(new Date()), 1000)
		return () => window.clearInterval(timer)
	}, [])

	useEffect(() => {
		//if (accessStage !== 'lock') return
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Enter') {
				setAccessStage('login')
			} else if (event.key === 'Escape') {
				setAccessStage('lock')
			}
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [accessStage])

	const selectedUser = useMemo(() => users.find((u) => u.username === selectedUsername) ?? null, [users, selectedUsername])
	const lockTime = useMemo(() => now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }), [now])
	const lockDate = useMemo(() => now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }), [now])

	const handleLogin = async () => {
		if (isLoggingIn) return
		setIsLoggingIn(true)
		setError(null)
		setAccessStage('auth')
		
		await new Promise(resolve => setTimeout(resolve, 520))
		
		const result = login(selectedUsername, password)
		if (!result.ok) {
			setError(result.error ?? 'Login fallito')
			setPassword('')
			setIsLoggingIn(false)
			setAccessStage('login')
			return
		}

		setAccessStage('granted')
		await new Promise(resolve => setTimeout(resolve, 700))
		setAccessStage('booting')
		await new Promise(resolve => setTimeout(resolve, 820))
		setAllowDesktopRender(true)
	}

	if (isAuthenticated && (allowDesktopRender || accessStage === 'lock')) return <>{children}</>

	return (
		<div className="h-screen w-screen relative overflow-hidden text-white font-sans select-none">
			<motion.div
				className="absolute inset-0 bg-cover bg-center"
				style={{ backgroundImage: "url('/wallpapers/default.jpg')" }}
				initial={{ scale: 1.18, filter: 'blur(2px)' }}
				animate={{ scale: accessStage === 'booting' ? 1.03 : accessStage === 'lock' ? 1.08 : 1.1, filter: 'blur(0px)' }}
				transition={{ duration: 1.2, ease: 'easeOut' }}
			/>
			
			<motion.div
				className="absolute inset-0 bg-black/20 backdrop-blur-md"
				initial={{ opacity: 0 }}
				animate={{ opacity: accessStage === 'booting' ? 0.55 : accessStage === 'lock' ? 0.92 : 1 }}
				transition={{ duration: 0.7 }}
			/>

			<motion.div
				className="pointer-events-none absolute inset-0"
				style={{
					background: 'radial-gradient(circle at 50% 30%, rgba(99,102,241,0.22) 0%, rgba(15,23,42,0) 55%)',
				}}
				animate={{ opacity: [0.45, 0.8, 0.45], scale: [1, 1.04, 1] }}
				transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
			/>

			<AnimatePresence mode="wait">
				{accessStage === 'lock' && (
					<motion.div
						key="lock-screen"
						className="absolute inset-0 z-10"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0, scale: 1.02, filter: 'blur(4px)' }}
					>
						<motion.div
							className="absolute inset-0 flex flex-col items-center justify-start pt-22"
							initial={{ y: -10, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							transition={{ duration: 0.75, ease: 'easeOut' }}
						>
							<motion.p
								className="text-8xl font-semibold text-white/95 leading-none tracking-tight drop-shadow-[0_10px_30px_rgba(0,0,0,0.55)]"
								animate={{ opacity: [0.9, 1, 0.9] }}
								transition={{ duration: 2.8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
							>
								{lockTime}
							</motion.p>
							<p className="mt-2 text-base capitalize text-white/75 tracking-wide">{lockDate}</p>
						</motion.div>

						<motion.button
							onClick={() => setAccessStage('login')}
							className="absolute inset-0 flex items-end justify-center pb-14"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
						>
							<motion.div
								className="px-5 py-2 rounded-full text-sm text-white/75 backdrop-blur-md border border-white/20 bg-white/10"
								animate={{ y: [0, -5, 0], opacity: [0.7, 1, 0.7] }}
								transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
							>
								Premi Enter per accedere
							</motion.div>
						</motion.button>
					</motion.div>
				)}

				{(accessStage === 'login' || accessStage === 'auth') && (
					<motion.div
						key="login-screen"
						className="absolute inset-0 flex flex-col items-center justify-center p-4"
						initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
						animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
						exit={{ opacity: 0, y: -12, filter: 'blur(6px)' }}
						transition={{ duration: 0.55, ease: 'easeOut' }}
					>
						<motion.div
							className="relative mb-5"
							animate={{ scale: isLoggingIn ? [1, 1.05, 1] : 1 }}
							transition={{ duration: 0.72, repeat: isLoggingIn ? Number.POSITIVE_INFINITY : 0, ease: 'easeInOut' }}
						>
							<div className="w-24 h-24 rounded-full bg-white/18 backdrop-blur-xl flex items-center justify-center overflow-hidden shadow-[0_18px_45px_rgba(0,0,0,0.45)] border border-white/15 ring-1 ring-white/20">
								{DEFAULT_AVATAR}
							</div>
							<motion.div
								className="absolute inset-0 rounded-full border border-cyan-300/40"
								animate={{ opacity: [0.1, 0.55, 0.1], scale: [1, 1.16, 1.24] }}
								transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: 'easeOut' }}
							/>
						</motion.div>

						<h1 className="text-2xl font-semibold mb-5 text-white drop-shadow-md tracking-wide">
							{selectedUser?.displayName || selectedUsername}
						</h1>

						<div className="w-full max-w-[250px] flex flex-col items-center gap-3">
							<div className="relative w-full">
								<motion.input
									type="password"
									value={password}
									onChange={(e) => {
										setPassword(e.target.value)
										setError(null)
									}}
									onKeyDown={(e) => {
										if (e.key === 'Enter') handleLogin()
									}}
									className="w-full bg-white/16 backdrop-blur-lg border border-white/20 rounded-full px-4 py-2 text-center text-sm placeholder-white/55 outline-none text-white"
									placeholder="Inserisci password"
									disabled={isLoggingIn}
									autoFocus
									animate={{ boxShadow: isLoggingIn ? '0 0 0 1px rgba(103,232,249,0.55), 0 0 22px rgba(34,211,238,0.25)' : '0 0 0 0 rgba(0,0,0,0)' }}
									transition={{ duration: 0.3 }}
								/>

								{password.length > 0 && !isLoggingIn && (
									<motion.button
										onClick={handleLogin}
										className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/12 hover:bg-white/20 text-white/90"
										whileHover={{ scale: 1.08 }}
										whileTap={{ scale: 0.95 }}
									>
										<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
											<path d="M5 12h14" />
											<path d="m12 5 7 7-7 7" />
										</svg>
									</motion.button>
								)}

								<AnimatePresence>
									{isLoggingIn && (
										<motion.div
											className="absolute right-2.5 top-1/2 -translate-y-1/2"
											initial={{ opacity: 0, scale: 0.7 }}
											animate={{ opacity: 1, scale: 1 }}
											exit={{ opacity: 0, scale: 0.7 }}
										>
											<div className="animate-spin h-3 w-3 border-2 border-white/50 border-t-transparent rounded-full" />
										</motion.div>
									)}
								</AnimatePresence>
							</div>

							<AnimatePresence>
								{error && (
									<motion.p
										className="text-xs text-red-100 bg-red-500/25 px-3 py-1 rounded-full backdrop-blur-sm"
										initial={{ opacity: 0, y: -4 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -4 }}
									>
										{error}
									</motion.p>
								)}
							</AnimatePresence>

							<button
								onClick={() => {
									setPassword('')
									setError(null)
									setAccessStage('lock')
								}}
								className="text-[11px] uppercase tracking-[0.16em] text-white/60 hover:text-white/85 transition-colors"
							>
								Torna al lock screen
							</button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{(accessStage === 'granted' || accessStage === 'booting') && (
					<motion.div
						className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-xl"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
					>
						<motion.div className="w-[min(86vw,620px)] px-4" initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.98, y: -8 }}>
							<div className="text-cyan-200/90 text-xs uppercase tracking-[0.22em] mb-2 text-center">Gh3spOS Security Layer</div>
							<div className="text-white text-2xl font-semibold mb-4 text-center">
								{accessStage === 'granted' ? 'ACCESS GRANTED' : 'INITIALIZING DESKTOP'}
							</div>
							<div className="h-2 rounded-full bg-white/15 overflow-hidden backdrop-blur-lg">
								<motion.div
									className="h-full bg-gradient-to-r from-cyan-300 to-violet-400"
									initial={{ width: '28%' }}
									animate={{ width: accessStage === 'granted' ? '64%' : '100%' }}
									transition={{ duration: accessStage === 'granted' ? 0.5 : 0.8, ease: 'easeInOut' }}
								/>
							</div>
							<div className="mt-4 text-sm text-white/80 text-center">
								{accessStage === 'granted' ? 'Authenticating user profile and privilege scope...' : 'Loading shell, widgets, notifications and secure runtime...'}
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			{users.length > 1 && accessStage === 'login' && (<>
				<div className="absolute bottom-24 left-0 right-0 flex justify-center gap-8 items-end h-20">
					{users.filter(u => u.username !== selectedUsername).map(u => (
						<motion.button
							key={u.id}
							onClick={() => {
								setSelectedUsername(u.username)
								setPassword('')
								setError(null)
							}}
							className="flex flex-col items-center gap-2 group opacity-60 hover:opacity-100 transition-all hover:-translate-y-1 duration-300"
							whileHover={{ y: -5, scale: 1.05 }}
							whileTap={{ scale: 0.96 }}
						>
							<div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur border border-white/5 flex items-center justify-center overflow-hidden shadow-lg group-hover:bg-white/20 group-hover:ring-2 ring-white/30 transition-all">
								<div className="w-8 h-8 opacity-80">
									{DEFAULT_AVATAR}
								</div>
							</div>
							<span className="text-xs font-medium text-white drop-shadow-md">{u.displayName}</span>
						</motion.button>
					))}
				</div>	
		</>
			)}
			
		</div>
	)
}


