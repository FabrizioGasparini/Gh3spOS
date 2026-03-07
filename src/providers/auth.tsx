import { createContext, useCallback, useContext, useEffect, useMemo } from 'react'
import { usePersistentStore } from '@/providers/persistent-store'

export type AuthUser = {
	id: string
	username: string
	displayName: string
	password: string
	role: 'admin' | 'user'
}

type LoginResult = {
	ok: boolean
	error?: string
}

type AuthContextType = {
	users: AuthUser[]
	currentUser: AuthUser | null
	isAuthenticated: boolean
	isAdmin: boolean
	login: (username: string, password: string) => LoginResult
	logout: () => void
	createUser: (input: { username: string; displayName: string; password: string; role?: 'admin' | 'user' }) => LoginResult
	updateUser: (input: { id: string; username?: string; displayName?: string; password?: string; role?: 'admin' | 'user' }) => LoginResult
}

const AuthContext = createContext<AuthContextType | null>(null)

const DEFAULT_USERS: AuthUser[] = [
	{
		id: 'user-admin',
		username: 'admin',
		displayName: 'Administrator',
		password: 'admin123',
		role: 'admin',
	},
	{
		id: 'user-guest',
		username: 'guest',
		displayName: 'Guest',
		password: 'guest',
		role: 'user',
	},
]

const normalizeUsername = (username: string) => username.trim().toLowerCase()

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
	const [users, setUsers] = usePersistentStore<AuthUser[]>('auth:users', DEFAULT_USERS)
	const [sessionUserId, setSessionUserId] = usePersistentStore<string | null>('auth:session-user-id', null)

	useEffect(() => {
		if (!users.some((u) => !u.role)) return
		setUsers((prev) => prev.map((user) => ({ ...user, role: user.role ?? (user.username === 'admin' ? 'admin' : 'user') })))
	}, [users, setUsers])

	const currentUser = useMemo(() => users.find((u) => u.id === sessionUserId) ?? null, [users, sessionUserId])
	const isAdmin = currentUser?.role === 'admin'

	const login = useCallback((username: string, password: string): LoginResult => {
		const normalized = normalizeUsername(username)
		if (!normalized) return { ok: false, error: 'Inserisci username' }
		if (!password.trim()) return { ok: false, error: 'Inserisci password' }

		const found = users.find((u) => normalizeUsername(u.username) === normalized)
		if (!found) return { ok: false, error: 'Utente non trovato' }
		if (found.password !== password) return { ok: false, error: 'Password non valida' }

		setSessionUserId(found.id)
		return { ok: true }
	}, [setSessionUserId, users])

	const logout = useCallback(() => {
		setSessionUserId(null)
	}, [setSessionUserId])

	const createUser = useCallback((input: { username: string; displayName: string; password: string; role?: 'admin' | 'user' }): LoginResult => {
		if (users.length > 0 && currentUser?.role !== 'admin') {
			return { ok: false, error: 'Solo un admin può creare nuovi utenti' }
		}

		const username = normalizeUsername(input.username)
		const displayName = input.displayName.trim()
		const password = input.password.trim()
		const role = input.role ?? 'user'

		if (username.length < 3) return { ok: false, error: 'Username minimo 3 caratteri' }
		if (displayName.length < 2) return { ok: false, error: 'Nome visualizzato minimo 2 caratteri' }
		if (password.length < 4) return { ok: false, error: 'Password minima 4 caratteri' }

		if (users.some((u) => normalizeUsername(u.username) === username)) {
			return { ok: false, error: 'Username già esistente' }
		}

		const nextUser: AuthUser = {
			id: `user-${crypto.randomUUID()}`,
			username,
			displayName,
			password,
			role,
		}

		setUsers((prev) => [...prev, nextUser])
		return { ok: true }
	}, [currentUser?.role, setUsers, users])

	const updateUser = useCallback((input: { id: string; username?: string; displayName?: string; password?: string; role?: 'admin' | 'user' }): LoginResult => {
		if (!currentUser) return { ok: false, error: 'Sessione non valida' }

		const target = users.find((u) => u.id === input.id)
		if (!target) return { ok: false, error: 'Utente non trovato' }

		const canManageAll = currentUser.role === 'admin'
		const isSelf = currentUser.id === target.id

		if (!canManageAll && !isSelf) {
			return { ok: false, error: 'Permessi insufficienti per modificare questo utente' }
		}

		const requestedUsername = input.username == undefined ? target.username : normalizeUsername(input.username)
		const requestedDisplayName = input.displayName == undefined ? target.displayName : input.displayName.trim()
		const requestedPassword = input.password == undefined ? target.password : input.password.trim()
		const requestedRole = input.role == undefined ? target.role : input.role

		if (!canManageAll) {
			if (requestedDisplayName.length < 2) return { ok: false, error: 'Nome visualizzato minimo 2 caratteri' }
			setUsers((prev) => prev.map((user) => user.id === target.id ? { ...user, displayName: requestedDisplayName } : user))
			return { ok: true }
		}

		if (requestedUsername.length < 3) return { ok: false, error: 'Username minimo 3 caratteri' }
		if (requestedDisplayName.length < 2) return { ok: false, error: 'Nome visualizzato minimo 2 caratteri' }
		if (requestedPassword.length < 4) return { ok: false, error: 'Password minima 4 caratteri' }

		if (users.some((u) => u.id !== target.id && normalizeUsername(u.username) === requestedUsername)) {
			return { ok: false, error: 'Username già esistente' }
		}

		setUsers((prev) => prev.map((user) => {
			if (user.id !== target.id) return user
			return {
				...user,
				username: requestedUsername,
				displayName: requestedDisplayName,
				password: requestedPassword,
				role: requestedRole,
			}
		}))

		return { ok: true }
	}, [currentUser, setUsers, users])

	const value: AuthContextType = {
		users,
		currentUser,
		isAuthenticated: !!currentUser,
		isAdmin,
		login,
		logout,
		createUser,
		updateUser,
	}

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
	const ctx = useContext(AuthContext)
	if (!ctx) throw new Error('useAuth must be used within AuthProvider')
	return ctx
}
