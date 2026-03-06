import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type Store = Record<string, unknown>
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

  useEffect(() => {
    localStorage.setItem('gh3sp-persistent-store', JSON.stringify(store))
  }, [store])

  const set = useCallback(<T,>(key: string, value: T) => {
    setStore((prev) => {
      if (Object.is(prev[key], value)) return prev
      const next = { ...prev, [key]: value }
      return next
    })
  }, [])

  const get = useCallback(<T,>(key: string): T | undefined => {
    return store[key] as T | undefined
  }, [store])

  const contextValue = useMemo(() => ({ get, set }), [get, set])

  return (
    <PersistentContext.Provider value={contextValue}>
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
  }, [ctx, key, value])

  const set = (v: T | ((prev: T) => T)) => {
    if (typeof v === 'function') {
      setValue(prev => (v as (prev: T) => T)(prev))
    } else {
      setValue(v)
    }
  }

  return [value, set]
}
