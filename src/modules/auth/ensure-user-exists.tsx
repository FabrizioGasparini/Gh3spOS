import { useAuth } from '@/providers/auth'
import { useEffect } from 'react'

export const EnsureUserExists = ({ children }: { children: React.ReactNode }) => {
	const { users, createUser } = useAuth()

	useEffect(() => {
		if (users.length > 0) return
		createUser({ username: 'admin', displayName: 'Administrator', password: 'admin123' })
	}, [users, createUser])

	return <>{children}</>
}

