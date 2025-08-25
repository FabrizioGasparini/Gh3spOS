import { createContext, useContext, useEffect, useState } from 'react'

type Store = Record<string, any>
type PersistentContextType = {
  get: <T>(key: string) => T | undefined
  set: <T>(key: string, value: T) => void
}

const PersistentContext = createContext<PersistentContextType | null>(null)

export const PersistentStoreProvider = ({ children }: { children: React.ReactNode }) => {
  const [store, setStore] = useState<Store>(() => {
    try {
      const raw = localStorage.getItem('gh3sp-persistent-store')
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

const set = <T,>(key: string, value: T) => {
    store[key] = value
    setStore(store)
    localStorage.setItem('gh3sp-persistent-store', JSON.stringify(store))
  }

  const get = <T,>(key: string): T | undefined => {
    return store[key]
  }

  return (
    <PersistentContext.Provider value={{ get, set }}>
      {children}
    </PersistentContext.Provider>
  )
}

export const usePersistentStore = <T,>(key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void] => {
  const ctx = useContext(PersistentContext)
  if (!ctx) throw new Error('usePersistentStore must be used within a PersistentStoreProvider')

    const saved = ctx.get<T>(key)
    const [value, setValue] = useState<T>(saved ?? defaultValue)

    useEffect(() => {
        ctx.set(key, value)
    }, [value])

  const set = (v: T | ((prev: T) => T)) => {
    if (typeof v === 'function') {
      setValue(prev => (v as (prev: T) => T)(prev))
    } else {
      setValue(v)
    }
  }

  return [value, set]
}
