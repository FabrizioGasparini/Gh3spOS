import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/providers/auth'

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

	useEffect(() => {
		if (users.length && !users.some((u) => u.username === selectedUsername)) {
			setSelectedUsername(users[0].username)
		}
	}, [users, selectedUsername])

	const selectedUser = useMemo(() => users.find((u) => u.username === selectedUsername) ?? null, [users, selectedUsername])

	const handleLogin = async () => {
		if (isLoggingIn) return
		setIsLoggingIn(true)
		setError(null)
		
		// Simulate a small delay for realism
		await new Promise(resolve => setTimeout(resolve, 600))
		
		const result = login(selectedUsername, password)
		if (!result.ok) {
			setError(result.error ?? 'Login fallito')
			setPassword('')
			setIsLoggingIn(false)
		}
	}

	if (isAuthenticated) return <>{children}</>

	return (
		<div className="h-screen w-screen relative overflow-hidden text-white font-sans select-none">
			{/* Wallpaper Background */}
			<div className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out scale-105" style={{ backgroundImage: "url('/wallpapers/default.jpg')" }} />
			
			{/* Blur Overlay */}
			<div className="absolute inset-0 bg-black/20 backdrop-blur-md transition-all duration-1000" />

			{/* Main Content */}
			<div className="absolute inset-0 flex flex-col items-center justify-center p-4">
				
				{/* User Avatar */}
				<div className="relative mb-6 group">
					<div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center overflow-hidden shadow-2xl border border-white/10 ring-1 ring-white/20">
						{DEFAULT_AVATAR}
					</div>
				</div>

				{/* User Name */}
				<h1 className="text-2xl font-semibold mb-6 text-white drop-shadow-md tracking-wide">
					{selectedUser?.displayName || selectedUsername}
				</h1>

				{/* Password Input Area */}
				<div className="w-full max-w-[200px] flex flex-col items-center gap-3">
					<div className="relative w-full group">
						<input
							type="password"
							value={password}
							onChange={(e) => {
								setPassword(e.target.value)
								setError(null)
							}}
							onKeyDown={(e) => {
								if (e.key === 'Enter') handleLogin()
							}}
							className="w-full bg-white/20 backdrop-blur-md border border-white/10 rounded-full px-4 py-1.5 text-center text-sm placeholder-white/50 outline-none focus:bg-white/30 transition-all shadow-inner text-white"
							placeholder="Enter Password"
							disabled={isLoggingIn}
							autoFocus
						/>
						
						{password.length > 0 && !isLoggingIn && (
							<button 
								onClick={handleLogin}
								className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/20 text-white/80 transition-colors"
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="M5 12h14" />
									<path d="m12 5 7 7-7 7" />
								</svg>
							</button>
						)}
						
						{isLoggingIn && (
							<div className="absolute right-2 top-1/2 -translate-y-1/2">
								<div className="animate-spin h-3 w-3 border-2 border-white/50 border-t-transparent rounded-full" />
							</div>
						)}
					</div>

					{error && (
						<p className="text-xs text-red-200 bg-red-500/20 px-2 py-0.5 rounded animate-pulse shadow-sm backdrop-blur-sm">
							{error}
						</p>
					)}
					
					<div className="text-[10px] text-white/50 mt-1 font-medium tracking-wider uppercase opacity-60 hover:opacity-100 transition-opacity cursor-pointer flex flex-col items-center gap-1">
						<span>Touch ID or Enter Password</span>
					</div>
				</div>
			</div>

			{/* User Switcher (Bottom) */}
			{users.length > 1 && (
				<div className="absolute bottom-24 left-0 right-0 flex justify-center gap-8 items-end h-20">
					{users.filter(u => u.username !== selectedUsername).map(u => (
						<button
							key={u.id}
							onClick={() => {
								setSelectedUsername(u.username)
								setPassword('')
								setError(null)
							}}
							className="flex flex-col items-center gap-2 group opacity-60 hover:opacity-100 transition-all hover:-translate-y-1 duration-300"
						>
							<div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur border border-white/5 flex items-center justify-center overflow-hidden shadow-lg group-hover:bg-white/20 group-hover:ring-2 ring-white/30 transition-all">
								<div className="w-8 h-8 opacity-80">
									{DEFAULT_AVATAR}
								</div>
							</div>
							<span className="text-xs font-medium text-white drop-shadow-md">{u.displayName}</span>
						</button>
					))}
				</div>
			)}
			
			{/* Bottom Action Bar */}
			<div className="absolute bottom-8 left-0 right-0 flex justify-center">
				<div className="flex gap-8 text-white/60 text-xs font-medium">
					<button className="hover:text-white transition-colors hover:scale-105 active:scale-95">Sleep</button>
					<button className="hover:text-white transition-colors hover:scale-105 active:scale-95">Restart</button>
					<button className="hover:text-white transition-colors hover:scale-105 active:scale-95">Shut Down</button>
				</div>
			</div>
		</div>
	)
}


