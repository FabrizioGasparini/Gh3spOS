import { useGlobalPicker } from '@/providers/global-picker'
import { useWindowManager } from '@/providers/window-manager'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Eye,
  EyeOff,
  FileCode,
  FileSearch,
  FileText,
  Save,
  Search,
  Undo2,
  Redo2,
  WrapText,
  Type,
  X,
} from 'lucide-react'

type Props = {
  windowId: string
  filePath?: string
  fileContent?: string
  onSaveSuccess?: (newPath: string) => void
}

type ToastTone = 'success' | 'error' | 'info'

type EditorTab = {
  id: string
  path: string
  name: string
  content: string
  savedContent: string
}

const BASE_URL = 'https://www.gh3sp.com/cloud/api'
const SESSION_KEY = 'gh3sp:notepad:session:v2'

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const fileNameFromPath = (path: string) => {
  const clean = String(path || '').replace(/\\/g, '/')
  const parts = clean.split('/').filter(Boolean)
  return parts[parts.length - 1] || 'Nuovo.txt'
}

const normalizeCloudPath = (value: string) => {
  const clean = String(value || '').replace('cloud.gh3sp.com', '').replace(/\\/g, '/').replace(/\/+/g, '/')
  if (!clean) return '/'
  return clean.startsWith('/') ? clean : `/${clean}`
}

const detectTabIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'md') return <FileCode className="h-3.5 w-3.5" />
  return <FileText className="h-3.5 w-3.5" />
}

export const NotePad = ({ windowId, filePath, fileContent, onSaveSuccess }: Props) => {
  const initialTab: EditorTab = {
    id: makeId(),
    path: filePath ? normalizeCloudPath(filePath) : '',
    name: filePath ? fileNameFromPath(filePath) : 'Nuovo.txt',
    content: fileContent || '',
    savedContent: fileContent || '',
  }

  const [tabs, setTabs] = useState<EditorTab[]>(() => {
    if (filePath) return [initialTab]
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return [initialTab]
      const parsed = JSON.parse(raw) as { tabs?: EditorTab[] }
      if (!Array.isArray(parsed.tabs) || parsed.tabs.length === 0) return [initialTab]
      return parsed.tabs
    } catch {
      return [initialTab]
    }
  })

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    if (filePath) return initialTab.id
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return initialTab.id
      const parsed = JSON.parse(raw) as { activeTabId?: string; tabs?: EditorTab[] }
      const found = parsed.tabs?.some((tab) => tab.id === parsed.activeTabId)
      return found && parsed.activeTabId ? parsed.activeTabId : (parsed.tabs?.[0]?.id || initialTab.id)
    } catch {
      return initialTab.id
    }
  })

  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null)
  const [wordWrap, setWordWrap] = useState(true)
  const [fontSize, setFontSize] = useState(14)
  const [findQuery, setFindQuery] = useState('')
  const [matchInfo, setMatchInfo] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const [previewMode, setPreviewMode] = useState(false)

  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const lastWindowTitleRef = useRef<string>('')
  const { openPicker } = useGlobalPicker()
  const { renameWindow } = useWindowManager()

  const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTabId)
  const activeTab = activeTabIndex >= 0 ? tabs[activeTabIndex] : tabs[0]

  useEffect(() => {
    const nextTitle = `${activeTab?.name || 'Notepad'} - Notepad`
    if (lastWindowTitleRef.current === nextTitle) return
    lastWindowTitleRef.current = nextTitle
    renameWindow(windowId, nextTitle)
  }, [activeTab?.name, renameWindow, windowId])

  useEffect(() => {
    const payload = JSON.stringify({ tabs, activeTabId })
    localStorage.setItem(SESSION_KEY, payload)
  }, [tabs, activeTabId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const ctrl = event.ctrlKey || event.metaKey
      if (!ctrl) return

      if (event.key.toLowerCase() === 's' && !event.shiftKey) {
        event.preventDefault()
        void handleSave()
      }
      if (event.key.toLowerCase() === 's' && event.shiftKey) {
        event.preventDefault()
        void handleSaveAs()
      }
      if (event.key.toLowerCase() === 'o') {
        event.preventDefault()
        void handleOpen()
      }
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const showToast = (message: string, tone: ToastTone = 'info') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 2400)
  }

  const isDirty = (tab: EditorTab) => tab.content !== tab.savedContent

  const stats = useMemo(() => {
    const content = activeTab?.content || ''
    const words = content.trim() ? content.trim().split(/\s+/).length : 0
    const chars = content.length
    const lines = content.length ? content.split(/\n/).length : 1
    return { words, chars, lines }
  }, [activeTab?.content])

  const updateTab = (tabId: string, updater: (tab: EditorTab) => EditorTab) => {
    setTabs((prev) => prev.map((tab) => (tab.id === tabId ? updater(tab) : tab)))
  }

  const updateActiveTabContent = (value: string) => {
    if (!activeTab) return
    updateTab(activeTab.id, (tab) => ({ ...tab, content: value }))
  }

  const handleOpen = async () => {
    try {
      const result = await openPicker({
        allow: 'file',
        action: 'Apri file',
        title: 'Apri file',
        fileExtensions: ['txt', 'md', 'log'],
      })

      if (!result?.path) return

      const normalized = normalizeCloudPath(result.path)
      const response = await fetch(`${BASE_URL}/read.php?path=${encodeURIComponent(normalized)}`)
      if (!response.ok) throw new Error('Errore nel caricamento del file')
      const payload = await response.json()

      const openedTab: EditorTab = {
        id: makeId(),
        path: normalized,
        name: result.file?.name || fileNameFromPath(normalized),
        content: payload.content || '',
        savedContent: payload.content || '',
      }

      setTabs((prev) => [...prev, openedTab])
      setActiveTabId(openedTab.id)
      setPreviewMode(false)
      showToast(`Aperto ${openedTab.name}`, 'success')
      onSaveSuccess?.(normalized)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Errore apertura file', 'error')
    }
  }

  const handleNewTab = () => {
    const newTab: EditorTab = {
      id: makeId(),
      path: '',
      name: `Nuovo-${tabs.length + 1}.txt`,
      content: '',
      savedContent: '',
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
    setPreviewMode(false)
  }

  const saveFile = async (path: string) => {
    if (!activeTab) return
    const normalized = normalizeCloudPath(path)
    if (normalized === '/') {
      showToast('Seleziona un file valido (non la root)', 'error')
      return
    }

    try {
      const response = await fetch(`${BASE_URL}/saveFile.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: normalized, content: activeTab.content }),
      })

      if (!response.ok) throw new Error('Errore nel salvataggio')

      const nextName = fileNameFromPath(normalized)
      updateTab(activeTab.id, (tab) => ({
        ...tab,
        path: normalized,
        name: nextName,
        savedContent: tab.content,
      }))

      showToast(`Salvato ${nextName}`, 'success')
      onSaveSuccess?.(normalized)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Errore salvataggio', 'error')
    }
  }

  const handleSave = async () => {
    if (!activeTab) return
    if (!activeTab.path || activeTab.path === '/' || activeTab.path.endsWith('/')) {
      await handleSaveAs()
      return
    }
    await saveFile(activeTab.path)
  }

  const handleSaveAs = async () => {
    try {
      const result = await openPicker({
        allow: 'file',
        action: 'Salva con nome',
        title: 'Salva con nome',
        allowRename: true,
        fileExtensions: ['txt', 'md', 'log'],
      })
      if (!result?.path) return
      await saveFile(result.path)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Errore salvataggio', 'error')
    }
  }

  const closeTab = (tabId: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((tab) => tab.id === tabId)
      const target = prev[idx]
      if (target && isDirty(target)) {
        const proceed = window.confirm(`Chiudere ${target.name} senza salvare?`)
        if (!proceed) return prev
      }

      const next = prev.filter((tab) => tab.id !== tabId)
      if (next.length === 0) {
        const fallback: EditorTab = { id: makeId(), path: '', name: 'Nuovo.txt', content: '', savedContent: '' }
        setActiveTabId(fallback.id)
        return [fallback]
      }

      const nextIndex = Math.max(0, Math.min(idx, next.length - 1))
      setActiveTabId(next[nextIndex].id)
      return next
    })
  }

  const runFind = (direction: 'next' | 'prev') => {
    const editor = textareaRef.current
    const content = activeTab?.content || ''
    const query = findQuery.trim()
    if (!editor || !content || !query) {
      setMatchInfo({ current: 0, total: 0 })
      return
    }

    const source = content.toLowerCase()
    const target = query.toLowerCase()

    const indexes: number[] = []
    let start = 0
    while (start < source.length) {
      const found = source.indexOf(target, start)
      if (found === -1) break
      indexes.push(found)
      start = found + target.length
    }

    if (indexes.length === 0) {
      setMatchInfo({ current: 0, total: 0 })
      showToast('Nessun risultato', 'info')
      return
    }

    const cursor = editor.selectionStart
    let chosen = 0

    if (direction === 'next') {
      chosen = indexes.findIndex((idx) => idx > cursor)
      if (chosen === -1) chosen = 0
    } else {
      chosen = [...indexes].reverse().findIndex((idx) => idx < cursor)
      chosen = chosen === -1 ? indexes.length - 1 : indexes.length - 1 - chosen
    }

    const begin = indexes[chosen]
    editor.focus()
    editor.setSelectionRange(begin, begin + target.length)
    setMatchInfo({ current: chosen + 1, total: indexes.length })
  }

  const activeExtension = activeTab?.name.split('.').pop()?.toLowerCase() || 'txt'
  const canPreview = activeExtension === 'md'

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl border border-white/15 bg-black/15 text-white flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-black/25">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => void handleOpen()} className="h-8 px-2.5 rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 text-xs inline-flex items-center gap-1.5">
            <FileSearch className="h-3.5 w-3.5" /> Apri
          </button>
          <button onClick={() => void handleSave()} className="h-8 px-2.5 rounded-lg border border-cyan-300/30 bg-cyan-500/20 hover:bg-cyan-500/30 text-xs inline-flex items-center gap-1.5">
            <Save className="h-3.5 w-3.5" /> Salva
          </button>
          <button onClick={() => void handleSaveAs()} className="h-8 px-2.5 rounded-lg border border-emerald-300/30 bg-emerald-500/20 hover:bg-emerald-500/30 text-xs">
            Salva con nome
          </button>
          <button onClick={handleNewTab} className="h-8 px-2.5 rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 text-xs">
            + Nuova
          </button>
          <button onClick={() => document.execCommand('undo')} className="h-8 px-2 rounded-lg border border-white/20 bg-white/10 hover:bg-white/15" title="Undo">
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => document.execCommand('redo')} className="h-8 px-2 rounded-lg border border-white/20 bg-white/10 hover:bg-white/15" title="Redo">
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setWordWrap((prev) => !prev)} className={`h-8 px-2.5 rounded-lg border text-xs inline-flex items-center gap-1.5 ${wordWrap ? 'border-cyan-300/30 bg-cyan-500/20' : 'border-white/20 bg-white/10 hover:bg-white/15'}`}>
            <WrapText className="h-3.5 w-3.5" /> Wrap
          </button>
          {canPreview ? (
            <button onClick={() => setPreviewMode((prev) => !prev)} className={`h-8 px-2.5 rounded-lg border text-xs inline-flex items-center gap-1.5 ${previewMode ? 'border-violet-300/30 bg-violet-500/20' : 'border-white/20 bg-white/10 hover:bg-white/15'}`}>
              {previewMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {previewMode ? 'Editor' : 'Preview'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-black/10">
        <div className="relative flex-1">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-white/55" />
          <input
            ref={searchInputRef}
            value={findQuery}
            onChange={(event) => {
              setFindQuery(event.target.value)
              setMatchInfo({ current: 0, total: 0 })
            }}
            placeholder="Cerca nel documento..."
            className="w-full h-8 rounded-lg border border-white/20 bg-black/20 pl-7 pr-2 text-xs outline-none focus:border-cyan-300/40"
          />
        </div>
        <button onClick={() => runFind('prev')} className="h-8 px-2 rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 text-xs">Prev</button>
        <button onClick={() => runFind('next')} className="h-8 px-2 rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 text-xs">Next</button>
        <span className="text-[11px] text-white/65 min-w-16 text-right">{matchInfo.current}/{matchInfo.total}</span>

        <div className="inline-flex items-center gap-1 text-[11px] text-white/70 pl-1 border-l border-white/10">
          <Type className="h-3.5 w-3.5" />
          <input
            type="range"
            min={12}
            max={22}
            value={fontSize}
            onChange={(event) => setFontSize(Number(event.target.value))}
            className="w-20"
          />
          <span className="w-7 text-right">{fontSize}</span>
        </div>
      </div>

      <div className="flex gap-1 px-2 py-1.5 border-b border-white/10 bg-black/5 overflow-x-auto hide-scrollbar">
        {tabs.map((tab) => {
          const active = tab.id === activeTab?.id
          const dirty = isDirty(tab)
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTabId(tab.id)
                setPreviewMode(false)
              }}
              className={`group inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border ${active ? 'bg-white/20 border-white/25' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
            >
              {detectTabIcon(tab.name)}
              <span className="max-w-32 truncate">{tab.name}</span>
              {dirty ? <span className="text-amber-200">•</span> : null}
              {tabs.length > 1 ? (
                <span
                  onClick={(event) => {
                    event.stopPropagation()
                    closeTab(tab.id)
                  }}
                  className="opacity-60 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="flex-1 min-h-0">
        {previewMode && canPreview ? (
          <div className="h-full w-full overflow-auto p-4">
            <article className="max-w-none text-sm leading-6 whitespace-pre-wrap break-words text-white/90">
              {activeTab?.content || ''}
            </article>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={activeTab?.content || ''}
            onChange={(event) => updateActiveTabContent(event.target.value)}
            className="h-full w-full bg-transparent text-white p-4 outline-none resize-none"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: 1.55,
              whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
              overflowWrap: wordWrap ? 'anywhere' : 'normal',
            }}
            spellCheck={false}
            placeholder="Scrivi qui..."
          />
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-white/10 bg-black/20 flex items-center justify-between text-[11px] text-white/65">
        <span className="truncate max-w-[60%]">{activeTab?.path || 'File non salvato'}</span>
        <span>{stats.lines} righe · {stats.words} parole · {stats.chars} caratteri</span>
      </div>

      {toast ? (
        <div
          className={`absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg border text-xs ${toast.tone === 'error' ? 'bg-rose-500/20 border-rose-300/35 text-rose-100' : toast.tone === 'success' ? 'bg-emerald-500/20 border-emerald-300/35 text-emerald-100' : 'bg-cyan-500/20 border-cyan-300/35 text-cyan-100'}`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  )
}
