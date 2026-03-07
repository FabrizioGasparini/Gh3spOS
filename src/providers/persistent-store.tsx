import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type Store = Record<string, unknown>
type PersistentContextType = {
  get: <T>(key: string) => T | undefined
  set: <T>(key: string, value: T | ((prev: T) => T)) => void
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

  const set = useCallback(<T,>(key: string, value: T | ((prev: T) => T)) => {
    setStore((prev) => {
      const current = prev[key] as T | undefined
      const nextValue = typeof value === 'function' ? (value as (prev: T) => T)((current as T)) : value
      if (Object.is(current, nextValue)) return prev
      const next = { ...prev, [key]: nextValue }
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
  const value = (saved ?? defaultValue) as T

  useEffect(() => {
    if (saved === undefined) {
      ctx.set(key, defaultValue)
    }
  }, [ctx, defaultValue, key, saved])

  const set = (v: T | ((prev: T) => T)) => {
    ctx.set(key, v)
  }

  return [value, set]
}
