// src/providers/apps.tsx
import { createContext, useContext } from 'react'
import { apps } from '@/apps/definitions'

const AppsContext = createContext(apps)

export const AppsProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <AppsContext.Provider value={apps}>
      {children}
    </AppsContext.Provider>
  )
}

export const useApps = () => useContext(AppsContext)
