import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { nanoid } from 'nanoid'
import { Files, FolderOpen, File as FileIcon, ChevronRight, Folder, X, TerminalSquare, Settings2, Search } from 'lucide-react'
import { useGlobalPicker } from '@/providers/global-picker'
import { Terminal as Gh3Terminal } from '@/apps/terminal'
import { AnimatePresence, motion } from 'framer-motion'
import { Gh3Preview } from '@/apps/gh3preview'

const BASE_URL = 'https://www.gh3sp.com/cloud/api'

type TreeItem = {
	name: string
	type: 'file' | 'folder' | 'disk'
}

type EditorTab = {
	id: string
	path: string
	code: string
	savedSnapshot: string
	loading: boolean
	saving: boolean
	mode?: 'editor' | 'preview'
	previewUrl?: string
	previewExtension?: 'txt' | 'md' | 'log' | 'png' | 'jpg' | 'jpeg' | 'gif' | 'pdf' | 'mp4' | 'webp'
}

type PaletteCommand = {
	id: string
	label: string
	run: () => void | Promise<void>
}

const detectLanguage = (path: string) => {
	const ext = path.split('.').pop()?.toLowerCase() || ''
	if (['ts', 'tsx'].includes(ext)) return 'typescript'
	if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) return 'javascript'
	if (ext === 'json') return 'json'
	if (ext === 'css') return 'css'
	if (ext === 'html') return 'html'
	if (ext === 'md') return 'markdown'
	if (ext === 'py') return 'python'
	if (ext === 'sh') return 'shell'
	if (ext === 'xml') return 'xml'
	if (ext === 'yml' || ext === 'yaml') return 'yaml'
	return 'plaintext'
}

const normalizePath = (value: string) => {
	const clean = String(value || '').replace(/\\+/g, '/').replace(/\/\/+/g, '/')
	return clean.startsWith('/') ? clean : `/${clean}`
}

const parentDir = (value: string) => {
	const normalized = normalizePath(value)
	const parts = normalized.split('/').filter(Boolean)
	parts.pop()
	return `/${parts.join('/')}` || '/'
}

const fileNameFromPath = (value: string) => {
	const parts = normalizePath(value).split('/').filter(Boolean)
	return parts[parts.length - 1] || 'untitled.txt'
}

const previewableExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'mp4', 'txt', 'md', 'log'])

export const VisualStudioCodeApp: React.FC<{ windowId: string; initialPath?: string; initialFolder?: string }> = ({ windowId, initialPath, initialFolder }) => {
	const { openPicker, activeRequestId } = useGlobalPicker()
	const [tabs, setTabs] = useState<EditorTab[]>([{ id: nanoid(), path: '/nuovo.txt', code: '', savedSnapshot: '', loading: false, saving: false }])
	const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id)
	const [selectedFolder, setSelectedFolder] = useState('/')
	const [message, setMessage] = useState<string>('Pronto')
	const [fileMenuOpen, setFileMenuOpen] = useState(false)
	const [settingsMenuOpen, setSettingsMenuOpen] = useState(false)
	const [treeEntries, setTreeEntries] = useState<Record<string, TreeItem[]>>({})
	const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
	const [treeLoading, setTreeLoading] = useState<Record<string, boolean>>({})
	const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'vs-light' | 'hc-black'>(() => {
		if (typeof window === 'undefined') return 'vs-dark'
		const stored = window.localStorage.getItem('gh3sp:vscode-theme')
		if (stored === 'vs-light' || stored === 'hc-black') return stored
		return 'vs-dark'
	})
	const [consoleOpen, setConsoleOpen] = useState<boolean>(() => {
		if (typeof window === 'undefined') return true
		return window.localStorage.getItem('gh3sp:vscode-console-open') !== 'false'
	})
	const [bootHandled, setBootHandled] = useState(false)
	const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
		if (typeof window === 'undefined') return true
		return window.localStorage.getItem('gh3sp:vscode-sidebar-open') !== 'false'
	})
	const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
		if (typeof window === 'undefined') return 280
		const value = Number(window.localStorage.getItem('gh3sp:vscode-sidebar-width') || '280')
		return Number.isFinite(value) ? Math.max(180, Math.min(560, value)) : 280
	})
	const [consoleHeight, setConsoleHeight] = useState<number>(() => {
		if (typeof window === 'undefined') return 192
		const value = Number(window.localStorage.getItem('gh3sp:vscode-console-height') || '192')
		return Number.isFinite(value) ? Math.max(120, Math.min(600, value)) : 192
	})
	const [paletteOpen, setPaletteOpen] = useState(false)
	const [paletteQuery, setPaletteQuery] = useState('')
	const [explorerQuery, setExplorerQuery] = useState('')
	const [activeTreePath, setActiveTreePath] = useState<string>('')
	const editorColumnRef = useRef<HTMLDivElement | null>(null)
	const paletteInputRef = useRef<HTMLInputElement | null>(null)

	const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]
	const path = activeTab?.path || '/nuovo.txt'
	const code = activeTab?.code || ''
	const savedSnapshot = activeTab?.savedSnapshot || ''
	const loading = Boolean(activeTab?.loading)
	const saving = Boolean(activeTab?.saving)

	const language = useMemo(() => detectLanguage(path), [path])
	const isDirty = (activeTab?.mode ?? 'editor') === 'editor' && code !== savedSnapshot
	const pickerBusy = activeRequestId !== null

	const updateTab = useCallback((tabId: string, updater: (current: EditorTab) => EditorTab) => {
		setTabs((prev) => prev.map((tab) => (tab.id === tabId ? updater(tab) : tab)))
	}, [])

	const updateActiveTab = useCallback((updater: (current: EditorTab) => EditorTab) => {
		setTabs((prev) => prev.map((tab) => (tab.id === activeTabId ? updater(tab) : tab)))
	}, [activeTabId])

	const joinPath = (base: string, name: string) => {
		const normalizedBase = normalizePath(base)
		if (normalizedBase === '/') return `/${name}`
		return `${normalizedBase}/${name}`.replace(/\/+/g, '/')
	}

	const openFromPath = useCallback(async (nextPathRaw: string, options?: { openInNewTab?: boolean }) => {
		if (!activeTab) return
		const nextPath = normalizePath(nextPathRaw)
		const existingTab = tabs.find((tab) => normalizePath(tab.path) === nextPath)
		let targetTabId = existingTab?.id

		if (!targetTabId && options?.openInNewTab) {
			const newTab: EditorTab = {
				id: nanoid(),
				path: nextPath,
				code: '',
				savedSnapshot: '',
				loading: true,
				saving: false,
			}
			setTabs((prev) => [...prev, newTab])
			targetTabId = newTab.id
		}

		if (!targetTabId) {
			targetTabId = activeTab.id
			updateActiveTab((tab) => ({ ...tab, path: nextPath }))
		}
		setActiveTabId(targetTabId)
		if (existingTab || !options?.openInNewTab) {
			updateTab(targetTabId, (tab) => ({ ...tab, loading: true }))
		}
		setMessage('Apertura file...')
		try {
			const response = await fetch(`${BASE_URL}/read.php?path=${encodeURIComponent(nextPath)}`)
			const payload = await response.json().catch(() => ({} as Record<string, unknown>))
			if (!response.ok) {
				throw new Error(typeof payload?.error === 'string' ? payload.error : 'Errore apertura file')
			}

			const extension = fileNameFromPath(nextPath).split('.').pop()?.toLowerCase() || 'txt'
			const isTextContent = typeof payload?.content === 'string'
			const canPreview = previewableExtensions.has(extension)

			if (isTextContent) {
				updateTab(targetTabId, (tab) => ({
					...tab,
					path: nextPath,
					code: payload.content as string,
					savedSnapshot: payload.content as string,
					loading: false,
					mode: 'editor',
					previewUrl: undefined,
					previewExtension: undefined,
				}))
				setMessage(`Aperto ${nextPath}`)
			} else if (canPreview) {
				const previewUrl = typeof payload?.url === 'string'
					? payload.url
					: `${BASE_URL}/read.php?path=${encodeURIComponent(nextPath)}`
				updateTab(targetTabId, (tab) => ({
					...tab,
					path: nextPath,
					code: '',
					savedSnapshot: '',
					loading: false,
					mode: 'preview',
					previewUrl,
					previewExtension: extension as EditorTab['previewExtension'],
				}))
				setMessage(`Preview ${nextPath}`)
			} else {
				throw new Error('Formato non testuale non supportato in editor/preview')
			}

			setSelectedFolder(parentDir(nextPath))
		} catch (error) {
			const text = String(error instanceof Error ? error.message : error)
			setMessage(text)
			updateTab(targetTabId, (tab) => ({ ...tab, loading: false }))
		} finally {
			updateTab(targetTabId, (tab) => ({ ...tab, loading: false }))
		}
	}, [activeTab, tabs, updateActiveTab, updateTab])

	const dirtyPaths = useMemo(() => new Set(
		tabs
			.filter((tab) => tab.code !== tab.savedSnapshot)
			.map((tab) => normalizePath(tab.path)),
	), [tabs])

	const saveFile = useCallback(async (tabId?: string) => {
		const targetTab = tabs.find((tab) => tab.id === (tabId ?? activeTabId))
		if (!targetTab) return
		if ((targetTab.mode ?? 'editor') !== 'editor') {
			setMessage('La preview non è modificabile: apri un file testuale per salvare')
			return
		}

		const targetPath = normalizePath(targetTab.path)
		updateTab(targetTab.id, (tab) => ({ ...tab, saving: true }))
		setMessage('Salvataggio...')
		try {
			const response = await fetch(`${BASE_URL}/saveFile.php`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: targetPath, content: targetTab.code }),
			})
			const payload = await response.json().catch(() => ({} as Record<string, unknown>))
			if (!response.ok) {
				throw new Error(typeof payload?.error === 'string' ? payload.error : 'Errore salvataggio file')
			}

			updateTab(targetTab.id, (tab) => ({ ...tab, path: targetPath, savedSnapshot: tab.code, saving: false }))
			setSelectedFolder(parentDir(targetPath))
			setMessage(`Salvato ${targetPath}`)
		} catch (error) {
			const text = String(error instanceof Error ? error.message : error)
			setMessage(text)
			updateTab(targetTab.id, (tab) => ({ ...tab, saving: false }))
		}
	}, [activeTabId, tabs, updateTab])

	const newFile = useCallback(() => {
		const nextIndex = tabs.filter((tab) => tab.path.startsWith('/nuovo')).length + 1
		const newTab: EditorTab = {
			id: nanoid(),
			path: nextIndex === 1 ? '/nuovo.txt' : `/nuovo-${nextIndex}.txt`,
			code: '',
			savedSnapshot: '',
			loading: false,
			saving: false,
		}
		setTabs((prev) => [...prev, newTab])
		setActiveTabId(newTab.id)
		setMessage('Nuovo file')
	}, [tabs])

	const closeTab = useCallback((tabId: string) => {
		setTabs((prev) => {
			if (prev.length <= 1) {
				return [{ id: nanoid(), path: '/nuovo.txt', code: '', savedSnapshot: '', loading: false, saving: false }]
			}

			const targetIndex = prev.findIndex((tab) => tab.id === tabId)
			const next = prev.filter((tab) => tab.id !== tabId)
			if (tabId === activeTabId) {
				const fallback = next[Math.max(0, targetIndex - 1)] ?? next[0]
				if (fallback) setActiveTabId(fallback.id)
			}
			return next
		})
	}, [activeTabId])

	const openFilePicker = useCallback(async () => {
		setFileMenuOpen(false)
		setPaletteOpen(false)
		const result = await openPicker({
			allow: 'file',
			action: 'Apri file',
			title: 'Apri file',
		})
		if (!result?.path) return
		await openFromPath(result.path)
	}, [openFromPath, openPicker])

	const openFolderPicker = useCallback(async () => {
		setFileMenuOpen(false)
		setPaletteOpen(false)
		const result = await openPicker({
			allow: 'folder',
			action: 'Apri cartella',
			title: 'Apri cartella',
		})
		if (!result?.path) return
		const folder = normalizePath(result.path)
		setSelectedFolder(folder)
		setMessage(`Cartella selezionata: ${folder}`)
	}, [openPicker])

	const paletteCommands = useMemo<PaletteCommand[]>(() => ([
		{ id: 'open-file', label: 'File: Apri file...', run: () => { void openFilePicker() } },
		{ id: 'open-folder', label: 'File: Apri cartella...', run: () => { void openFolderPicker() } },
		{ id: 'new-file', label: 'File: Nuovo file', run: () => newFile() },
		{ id: 'save-file', label: 'File: Salva', run: () => { void saveFile() } },
		{ id: 'toggle-sidebar', label: sidebarOpen ? 'View: Nascondi Sidebar' : 'View: Mostra Sidebar', run: () => setSidebarOpen((prev) => !prev) },
		{ id: 'toggle-terminal', label: consoleOpen ? 'View: Nascondi Terminale' : 'View: Mostra Terminale', run: () => setConsoleOpen((prev) => !prev) },
		{ id: 'theme-dark', label: 'Theme: Dark', run: () => setEditorTheme('vs-dark') },
		{ id: 'theme-light', label: 'Theme: Light', run: () => setEditorTheme('vs-light') },
		{ id: 'theme-high-contrast', label: 'Theme: High Contrast', run: () => setEditorTheme('hc-black') },
	]), [consoleOpen, newFile, openFilePicker, openFolderPicker, saveFile, sidebarOpen])

	const filteredPaletteCommands = useMemo(() => {
		const query = paletteQuery.trim().toLowerCase()
		if (!query) return paletteCommands
		return paletteCommands.filter((item) => item.label.toLowerCase().includes(query))
	}, [paletteCommands, paletteQuery])

	const loadFolderChildren = useCallback(async (folderPathRaw: string) => {
		const folderPath = normalizePath(folderPathRaw)
		setTreeLoading((prev) => ({ ...prev, [folderPath]: true }))
		try {
			const response = await fetch(`${BASE_URL}/list2.php?path=${encodeURIComponent(folderPath)}`)
			const payload = await response.json().catch(() => [])
			if (!response.ok || !Array.isArray(payload)) {
				throw new Error('Impossibile leggere la cartella')
			}

			const entries: TreeItem[] = payload
				.filter((item) => item && (item.type === 'file' || item.type === 'folder'))
				.map((item) => ({ name: String(item.name || ''), type: item.type as 'file' | 'folder' | 'disk' }))
				.sort((a, b) => {
					if (a.type === b.type) return a.name.localeCompare(b.name)
					return a.type === 'folder' ? -1 : 1
				})

			setTreeEntries((prev) => ({ ...prev, [folderPath]: entries }))
		} catch {
			setTreeEntries((prev) => ({ ...prev, [folderPath]: [] }))
		} finally {
			setTreeLoading((prev) => ({ ...prev, [folderPath]: false }))
		}
	}, [])

	const toggleFolder = useCallback((folderPathRaw: string) => {
		const folderPath = normalizePath(folderPathRaw)
		setExpandedFolders((prev) => {
			const nextExpanded = !prev[folderPath]
			return { ...prev, [folderPath]: nextExpanded }
		})
		if (!treeEntries[folderPath]) {
			void loadFolderChildren(folderPath)
		}
	}, [loadFolderChildren, treeEntries])

	useEffect(() => {
		const root = normalizePath(selectedFolder)
		setExpandedFolders({ [root]: true })
		void loadFolderChildren(root)
	}, [selectedFolder, loadFolderChildren])

	useEffect(() => {
		if (bootHandled) return
		setBootHandled(true)

		if (typeof initialFolder === 'string' && initialFolder.trim()) {
			setSelectedFolder(normalizePath(initialFolder))
		}

		if (typeof initialPath === 'string' && initialPath.trim()) {
			void openFromPath(initialPath)
		}
	}, [bootHandled, initialFolder, initialPath, openFromPath])

	useEffect(() => {
		window.localStorage.setItem('gh3sp:vscode-theme', editorTheme)
	}, [editorTheme])

	useEffect(() => {
		window.localStorage.setItem('gh3sp:vscode-sidebar-open', String(sidebarOpen))
	}, [sidebarOpen])

	useEffect(() => {
		window.localStorage.setItem('gh3sp:vscode-sidebar-width', String(sidebarWidth))
	}, [sidebarWidth])

	useEffect(() => {
		window.localStorage.setItem('gh3sp:vscode-console-open', String(consoleOpen))
	}, [consoleOpen])

	useEffect(() => {
		window.localStorage.setItem('gh3sp:vscode-console-height', String(consoleHeight))
	}, [consoleHeight])

	useEffect(() => {
		if (!paletteOpen) return
		requestAnimationFrame(() => {
			paletteInputRef.current?.focus()
			paletteInputRef.current?.select()
		})
	}, [paletteOpen])

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
				event.preventDefault()
				setPaletteOpen(true)
				setPaletteQuery('')
				return
			}
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
				event.preventDefault()
				void openFilePicker()
				return
			}
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
				event.preventDefault()
				void saveFile()
			}
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') {
				event.preventDefault()
				closeTab(activeTabId)
			}
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
				event.preventDefault()
				newFile()
			}
			if (event.key === 'Escape') {
				setPaletteOpen(false)
			}
			if (paletteOpen && event.key === 'Enter') {
				event.preventDefault()
				const first = filteredPaletteCommands[0]
				if (!first) return
				setPaletteOpen(false)
				setPaletteQuery('')
				void first.run()
			}
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [activeTabId, closeTab, filteredPaletteCommands, newFile, openFilePicker, paletteOpen, saveFile])

	const renderTree = (folderPathRaw: string, depth = 0): React.ReactNode => {
		const folderPath = normalizePath(folderPathRaw)
		const entries = treeEntries[folderPath] || []
		const isBusy = treeLoading[folderPath]
		const query = explorerQuery.trim().toLowerCase()
		const visibleEntries = !query
			? entries
			: entries.filter((entry) => entry.name.toLowerCase().includes(query))

		if (isBusy && entries.length === 0) {
			return (
				<div className="px-2 py-2" style={{ paddingLeft: `${8 + depth * 14}px` }}>
					<motion.div
						className="h-4 w-[75%] rounded bg-white/10"
						animate={{ opacity: [0.35, 0.85, 0.35] }}
						transition={{ duration: 1.2, repeat: Infinity }}
					/>
				</div>
			)
		}

		if (!isBusy && visibleEntries.length === 0) {
			return <div className="text-xs text-white/40 px-2 py-1" style={{ paddingLeft: `${8 + depth * 14}px` }}>{query ? 'Nessun risultato' : 'Cartella vuota'}</div>
		}

		return visibleEntries.map((entry, index) => {
			const itemPath = joinPath(folderPath, entry.name)
			const isFolder = entry.type === 'folder'
			const isExpanded = Boolean(expandedFolders[itemPath])
			const isActive = activeTreePath === itemPath
			const isDirtyFile = !isFolder && dirtyPaths.has(itemPath)

			return (
				<motion.div
					key={itemPath}
					initial={{ opacity: 0, y: 4 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.16, delay: Math.min(index * 0.015, 0.12) }}
				>
					<motion.button
						onClick={() => {
							setActiveTreePath(itemPath)
							if (isFolder) {
								toggleFolder(itemPath)
								return
							}
						}}
						onDoubleClick={() => {
							if (isFolder) return
							void openFromPath(itemPath, { openInNewTab: true })
						}}
						whileHover={{ x: 2 }}
						className={`w-full text-left text-xs rounded-sm px-2 py-1.5 flex items-center gap-1 transition-colors ${isActive ? 'bg-[#007acc33] text-white border border-[#4FC1FF55]' : 'text-white/85 hover:bg-white/10 border border-transparent'}`}
						style={{ paddingLeft: `${8 + depth * 14}px` }}
					>
						{isFolder ? (
							<motion.span animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.16 }} className="inline-flex">
								<ChevronRight size={12} className="shrink-0" />
							</motion.span>
						) : (
							<span className="w-3" />
						)}
						{isFolder ? <Folder size={12} className={`shrink-0 ${isExpanded ? 'text-[#f2c57c]' : 'text-[#dcb67a]'}`} /> : <FileIcon size={12} className="shrink-0 text-white/70" />}
						<span className="truncate">{entry.name}</span>
						{isDirtyFile && <span className="ml-1 text-[#4FC1FF] text-[10px]">●</span>}
						{isFolder && <span className="ml-auto text-[10px] text-white/35">dir</span>}
					</motion.button>
					<AnimatePresence initial={false}>
					{isFolder && isExpanded && (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: 'auto', opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={{ duration: 0.2 }}
							className="overflow-hidden"
						>
							{renderTree(itemPath, depth + 1)}
						</motion.div>
					)}
					</AnimatePresence>
				</motion.div>
			)
		})
	}

	const startSidebarResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
		event.preventDefault()
		const startX = event.clientX
		const startWidth = sidebarWidth

		const onMove = (moveEvent: PointerEvent) => {
			const next = startWidth + (moveEvent.clientX - startX)
			setSidebarWidth(Math.max(180, Math.min(560, next)))
		}

		const onUp = () => {
			document.removeEventListener('pointermove', onMove)
			document.removeEventListener('pointerup', onUp)
		}

		document.addEventListener('pointermove', onMove)
		document.addEventListener('pointerup', onUp)
	}, [sidebarWidth])

	const startConsoleResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
		event.preventDefault()
		const startY = event.clientY
		const startHeight = consoleHeight

		const onMove = (moveEvent: PointerEvent) => {
			const maxHeight = Math.max(140, (editorColumnRef.current?.getBoundingClientRect().height || 500) - 140)
			const next = startHeight + (startY - moveEvent.clientY)
			setConsoleHeight(Math.max(120, Math.min(maxHeight, next)))
		}

		const onUp = () => {
			document.removeEventListener('pointermove', onMove)
			document.removeEventListener('pointerup', onUp)
		}

		document.addEventListener('pointermove', onMove)
		document.addEventListener('pointerup', onUp)
	}, [consoleHeight])

	return (
		<div className="h-full w-full bg-[#1e1e1e] rounded-xl overflow-hidden border border-white/10 flex flex-col text-white">
			{paletteOpen && (
				<div className="absolute inset-0 z-[70] bg-black/30 backdrop-blur-[1px] flex items-start justify-center pt-14" onClick={() => setPaletteOpen(false)}>
					<div className="w-[560px] max-w-[90%] rounded-lg border border-white/15 bg-[#1f1f1f] shadow-2xl" onClick={(event) => event.stopPropagation()}>
						<div className="h-10 px-3 border-b border-white/10 flex items-center gap-2 text-white/80">
							<Search size={14} />
							<input
								ref={paletteInputRef}
								value={paletteQuery}
								onChange={(event) => setPaletteQuery(event.target.value)}
								placeholder="Digita un comando"
								className="w-full bg-transparent outline-none text-sm placeholder:text-white/40"
							/>
						</div>
						<div className="max-h-[280px] overflow-auto custom-scroll py-1">
							{filteredPaletteCommands.length === 0 && (
								<div className="px-3 py-2 text-sm text-white/50">Nessun comando</div>
							)}
							{filteredPaletteCommands.map((item) => (
								<button
									key={item.id}
									onClick={() => {
										setPaletteOpen(false)
										setPaletteQuery('')
										void item.run()
									}}
									className="w-full text-left px-3 py-2 text-sm hover:bg-white/10"
								>
									{item.label}
								</button>
							))}
						</div>
					</div>
				</div>
			)}

			<div className="h-8 bg-[#323233] border-b border-[#252526] flex items-center px-2 text-xs text-white/80 select-none relative">
				<div className="relative">
					<button
						onClick={() => setFileMenuOpen((prev) => !prev)}
						className="px-2 py-1 rounded hover:bg-white/10"
					>
						File
					</button>
					{fileMenuOpen && (
						<div className="absolute left-0 top-7 w-52 bg-[#252526] border border-white/10 rounded-md shadow-xl z-40 py-1 text-[12px]">
							<button onClick={() => void openFilePicker()} disabled={pickerBusy} className="w-full text-left px-3 py-1.5 hover:bg-white/10 disabled:opacity-50">Apri file...</button>
							<button onClick={() => void openFolderPicker()} disabled={pickerBusy} className="w-full text-left px-3 py-1.5 hover:bg-white/10 disabled:opacity-50">Apri cartella...</button>
							<button onClick={newFile} className="w-full text-left px-3 py-1.5 hover:bg-white/10">Nuovo file</button>
							<button onClick={() => void saveFile()} className="w-full text-left px-3 py-1.5 hover:bg-white/10">Salva</button>
						</div>
					)}
				</div>
				<div className="relative ml-1">
					<button
						onClick={() => setSettingsMenuOpen((prev) => !prev)}
						className="px-2 py-1 rounded hover:bg-white/10 flex items-center gap-1"
					>
						<Settings2 size={12} />
						Impostazioni
					</button>
					{settingsMenuOpen && (
						<div className="absolute left-0 top-7 w-56 bg-[#252526] border border-white/10 rounded-md shadow-xl z-40 py-1 text-[12px]">
							<div className="px-3 py-1 text-white/60">Tema editor</div>
							<button onClick={() => setEditorTheme('vs-dark')} className="w-full text-left px-3 py-1.5 hover:bg-white/10">Dark</button>
							<button onClick={() => setEditorTheme('vs-light')} className="w-full text-left px-3 py-1.5 hover:bg-white/10">Light</button>
							<button onClick={() => setEditorTheme('hc-black')} className="w-full text-left px-3 py-1.5 hover:bg-white/10">High Contrast</button>
							<div className="h-px bg-white/10 my-1" />
							<button onClick={() => setConsoleOpen((prev) => !prev)} className="w-full text-left px-3 py-1.5 hover:bg-white/10">
								{consoleOpen ? 'Nascondi console' : 'Mostra console'}
							</button>
						</div>
					)}
				</div>
				<div className="ml-4 text-white/70 truncate">Visual Studio Code · GH3spOS</div>
				<button onClick={() => { setPaletteOpen(true); setPaletteQuery('') }} className="ml-auto px-2 py-1 rounded hover:bg-white/10 text-[11px] text-white/70">⌘⇧P</button>
			</div>

			<div className="flex flex-1 min-h-0">
				<div className="w-11 bg-[#333333] border-r border-[#252526] flex flex-col items-center py-2 gap-2">
					<button
						onClick={() => setSidebarOpen((prev) => !prev)}
						className={`w-8 h-8 rounded flex items-center justify-center ${sidebarOpen ? 'bg-white/20' : 'bg-white/10 hover:bg-white/15'}`}
						title={sidebarOpen ? 'Nascondi sidebar' : 'Mostra sidebar'}
					>
						<Files size={16} />
					</button>
					<button
						onClick={() => setConsoleOpen((prev) => !prev)}
						className={`w-8 h-8 rounded flex items-center justify-center ${consoleOpen ? 'bg-white/20' : 'bg-white/10 hover:bg-white/15'}`}
						title={consoleOpen ? 'Nascondi console' : 'Mostra console'}
					>
						<TerminalSquare size={16} />
					</button>
				</div>

				<AnimatePresence initial={false}>
				{sidebarOpen && (
					<>
						<motion.div
							initial={{ width: 0, opacity: 0 }}
							animate={{ width: sidebarWidth, opacity: 1 }}
							exit={{ width: 0, opacity: 0 }}
							transition={{ duration: 0.18 }}
							className="bg-[#252526] border-r border-[#1f1f1f] flex flex-col overflow-hidden"
						>
							<div className="px-3 py-2 border-b border-white/10 text-[11px] uppercase tracking-wide text-white/60 flex items-center justify-between gap-2">
								<span>Explorer</span>
								<button onClick={() => setSidebarOpen(false)} className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/10">Nascondi</button>
							</div>
							<div className="px-3 pt-2 pb-2 border-b border-white/10">
								<div className="relative">
									<Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40" />
									<input
										value={explorerQuery}
										onChange={(event) => setExplorerQuery(event.target.value)}
										placeholder="Cerca in explorer"
										className="w-full h-7 rounded bg-white/10 pl-7 pr-2 text-[11px] text-white/85 placeholder:text-white/40 outline-none border border-transparent focus:border-[#4FC1FF55]"
									/>
								</div>
							</div>
							<div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
								<button onClick={() => void openFolderPicker()} disabled={pickerBusy} className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 flex items-center gap-1 disabled:opacity-50">
									<FolderOpen size={13} /> Apri cartella
								</button>
								<button onClick={() => void openFilePicker()} disabled={pickerBusy} className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 flex items-center gap-1 disabled:opacity-50">
									<FileIcon size={13} /> Apri file
								</button>
							</div>
							<div className="px-3 py-3 text-sm text-white/90 flex-1 min-h-0 overflow-auto custom-scroll">
								<div className="text-[11px] uppercase text-white/50 mb-2 flex items-center justify-between gap-2">
									<span className="truncate">{selectedFolder}</span>
									<span className="text-[10px] text-white/35">{(treeEntries[selectedFolder] || []).length} item</span>
								</div>
								<div className="">
									{renderTree(selectedFolder, 0)}
								</div>
							</div>
						</motion.div>
						<div
							onPointerDown={startSidebarResize}
							className="w-1 cursor-col-resize bg-white/5 hover:bg-white/15 active:bg-white/20"
							title="Ridimensiona sidebar"
						/>
					</>
				)}
				</AnimatePresence>

				<div ref={editorColumnRef} className="flex-1 min-w-0 flex flex-col bg-[#1e1e1e]">
					<div className="h-9 bg-[#2d2d2d] border-b border-[#1f1f1f] flex items-end px-2 gap-1 overflow-x-auto custom-scroll">
						{tabs.map((tab) => {
							const tabName = fileNameFromPath(tab.path)
							const tabDirty = (tab.mode ?? 'editor') === 'editor' && tab.code !== tab.savedSnapshot
							const active = tab.id === activeTabId
							return (
								<div
									key={tab.id}
									className={`h-8 px-3 rounded-t-md border border-[#1f1f1f] border-b-0 text-xs flex items-center gap-2 max-w-[240px] ${active ? 'bg-[#1e1e1e] text-white/95' : 'bg-[#2a2a2a] text-white/70'}`}
								>
									<button onClick={() => setActiveTabId(tab.id)} className="flex items-center gap-2 min-w-0">
										<span className="truncate max-w-[130px]">{tabName}</span>
										{tabDirty && <span className="text-[#4FC1FF]">●</span>}
									</button>
									<button onClick={() => closeTab(tab.id)} className="hover:bg-white/10 rounded p-0.5">
										<X size={12} />
									</button>
								</div>
							)
						})}
					</div>

					<div className="flex-1 min-h-0">
						{(activeTab?.mode ?? 'editor') === 'preview' && activeTab?.previewUrl && activeTab.previewExtension ? (
							<div className="h-full bg-[#1e1e1e]">
								<div className="h-8 px-3 flex items-center text-[11px] text-white/65 border-b border-white/10 bg-[#232323]">
									Preview · {activeTab.previewExtension.toUpperCase()}
								</div>
								<div className="h-[calc(100%-2rem)] overflow-auto custom-scroll p-2">
									<Gh3Preview
										windowId={windowId}
										fileContent={activeTab.previewUrl}
										fileExtension={activeTab.previewExtension}
										mime="application/octet-stream"
									/>
								</div>
							</div>
						) : (
							<Editor
								height="100%"
								language={language}
								value={code}
								onChange={(value: string | undefined) => {
									updateActiveTab((tab) => ({ ...tab, code: value ?? '' }))
								}}
								theme={editorTheme}
								options={{
									fontSize: 13,
									minimap: { enabled: true },
									wordWrap: 'on',
									automaticLayout: true,
									scrollBeyondLastLine: false,
									padding: { top: 8 },
								}}
							/>
						)}
					</div>

					{consoleOpen && (
						<div style={{ height: `${consoleHeight}px` }} className="border-t border-[#1f1f1f] bg-[#171717] flex flex-col min-h-[120px]">
							<div
								onPointerDown={startConsoleResize}
								className="h-1 cursor-row-resize bg-white/5 hover:bg-white/15 active:bg-white/20"
								title="Ridimensiona console"
							/>
							<div className="h-8 border-b border-white/10 px-3 flex items-center justify-between text-[11px] text-white/80">
								<div className="flex items-center gap-2"><TerminalSquare size={13} /> Terminale</div>
								<button onClick={() => setConsoleOpen(false)} className="px-2 py-0.5 rounded hover:bg-white/10">Nascondi</button>
							</div>
							<div className="flex-1 min-h-0 p-1.5">
								<Gh3Terminal windowId={`vscode-console-${windowId}`} />
							</div>
						</div>
					)}

					<div className="h-6 bg-[#007acc] text-white text-[11px] px-2 flex items-center justify-between">
						<div className="truncate">{message}</div>
						<div className="flex items-center gap-3 text-white/95">
							<span>{(activeTab?.mode ?? 'editor') === 'preview' ? 'preview' : language}</span>
							<span>{loading ? 'Apertura...' : saving ? 'Salvataggio...' : isDirty ? 'Unsaved' : 'Saved'}</span>
							<span>{pickerBusy ? 'Picker attivo' : 'UTF-8'}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
