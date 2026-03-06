import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/providers/auth'

export const EnsureLoggedIn = ({ children }: { children: React.ReactNode }) => {
	const { isAuthenticated, users, login } = useAuth()
	const [selectedUsername, setSelectedUsername] = useState(users[0]?.username ?? '')
	const [password, setPassword] = useState('')
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (users.length && !users.some((u) => u.username === selectedUsername)) {
			setSelectedUsername(users[0].username)
		}
	}, [users, selectedUsername])

	const selectedUser = useMemo(() => users.find((u) => u.username === selectedUsername) ?? null, [users, selectedUsername])

	if (isAuthenticated) return <>{children}</>

	return (
		<div className="h-screen w-screen relative overflow-hidden text-white">
			<div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/wallpapers/default.jpg')" }} />
			<div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" />
			<div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl" />
			<div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />

			<div className="absolute inset-0 grid place-items-center p-6">
				<div className="w-full max-w-md rounded-3xl border border-white/25 bg-black/30 backdrop-blur-3xl p-6 space-y-5 shadow-2xl">
					<div className="text-center">
						<p className="text-[11px] uppercase tracking-[0.26em] text-white/60">Gh3spOS Lock Screen</p>
						<h1 className="text-3xl font-semibold mt-1">Sign in</h1>
						<p className="text-white/70 mt-1 text-sm">Seleziona un account e inserisci la password</p>
					</div>

					<div className="space-y-2">
						<label className="text-xs text-white/70">Utente</label>
						<select
							value={selectedUsername}
							onChange={(e) => {
								setSelectedUsername(e.target.value)
								setError(null)
							}}
							className="w-full bg-white/10 border border-white/25 rounded-xl px-3 py-2.5 outline-none focus:border-white/50"
						>
							{users.map((u) => (
								<option key={u.id} value={u.username} className="bg-slate-900">
									{u.displayName} ({u.username}) {u.role === 'admin' ? '• admin' : ''}
								</option>
							))}
						</select>
					</div>

					<div className="space-y-2">
						<label className="text-xs text-white/70">Password {selectedUser ? `per ${selectedUser.displayName}` : ''}</label>
						<input
							type="password"
							value={password}
							onChange={(e) => {
								setPassword(e.target.value)
								setError(null)
							}}
							onKeyDown={(e) => {
								if (e.key !== 'Enter') return
								const result = login(selectedUsername, password)
								if (!result.ok) setError(result.error ?? 'Login fallito')
							}}
							className="w-full bg-white/10 border border-white/25 rounded-xl px-3 py-2.5 outline-none focus:border-white/50"
							placeholder="Inserisci password"
						/>
					</div>

					{error && <p className="text-sm text-red-300">{error}</p>}

					<button
						onClick={() => {
							const result = login(selectedUsername, password)
							if (!result.ok) setError(result.error ?? 'Login fallito')
						}}
						className="w-full rounded-xl bg-emerald-500/85 hover:bg-emerald-500 px-3 py-2.5 font-medium"
					>
						Accedi
					</button>
				</div>
			</div>
		</div>
	)
}

