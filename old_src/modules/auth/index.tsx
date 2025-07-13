// src/modules/auth/index.tsx
import React, { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

const listeners = new Set<(auth: boolean) => void>()

const fakeAuth = {
    isAuthenticated: false,
    login(cb: () => void) {
      fakeAuth.isAuthenticated = true
      listeners.forEach((fn) => fn(true))
      setTimeout(cb, 100)
    },
    logout(cb: () => void) {
      fakeAuth.isAuthenticated = false
      listeners.forEach((fn) => fn(false))
      setTimeout(cb, 100)
    },
    subscribe(fn: (auth: boolean) => void) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
  

export function useAuth() {
    const [isAuthenticated, setIsAuthenticated] = React.useState(fakeAuth.isAuthenticated)
  
    React.useEffect(() => {
      const unsubscribe = fakeAuth.subscribe(setIsAuthenticated)
      return unsubscribe
    }, [])
  
    return { isAuthenticated }
}
  


export function EnsureLoggedIn({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

export function EnsureLoggedOut({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

// Export anche fakeAuth per test in login
export { fakeAuth }
