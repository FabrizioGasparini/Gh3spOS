import { createContext, useContext, useRef } from "react"

type PreviewRefsMap = Map<string, HTMLElement | null>

const PreviewRefsContext = createContext<{
  setPreviewRef: (id: string, el: HTMLElement | null) => void
  getPreviewRef: (id: string) => HTMLElement | null
}>({
  setPreviewRef: () => {},
  getPreviewRef: () => null,
})

export const usePreviewRefs = () => useContext(PreviewRefsContext)

export const PreviewRefsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const refs = useRef<PreviewRefsMap>(new Map())

    const setPreviewRef = (id: string, el: HTMLElement | null) => {
        refs.current.set(id, el)
    }

    const getPreviewRef = (id: string) => {
        return refs.current.get(id) ?? null
    }

    return (
        <PreviewRefsContext.Provider value={{ setPreviewRef, getPreviewRef }}>
            {children}
        </PreviewRefsContext.Provider>
    )
}
