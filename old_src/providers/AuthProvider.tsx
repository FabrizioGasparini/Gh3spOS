// src/providers/AuthProvider.tsx
import React, { createContext, useEffect, useState } from 'react'

type User = {
  id: string
  email: string
  name?: string
}

type AuthContextType = {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('auth:user')
    if (saved) {
      setUser(JSON.parse(saved))
    }
    setIsLoading(false)
  }, [])

  const login = async () => {
    // Puoi chiamare un'API qui
    const mockUser = { id: '123', email: "test@email.com", name: 'Fabri Dev' }
    localStorage.setItem('auth:user', JSON.stringify(mockUser))
    setUser(mockUser)
  }

  const logout = () => {
    localStorage.removeItem('auth:user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}