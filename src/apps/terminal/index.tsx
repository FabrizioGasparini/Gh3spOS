import { useEffect, useMemo, useRef } from 'react'
import { useWindowManager } from '@/providers/window-manager'
import { useWidgetManager } from '@/providers/widget-manager'
import { useWallpaper } from '@/providers/wallpaper'
import { usePersistentStore } from '@/providers/persistent-store'
import { useApps } from '@/providers/apps'
import { commandHandlers, commandSuggestions } from './commands'
import type { TerminalContext, VfsNode } from './types'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'

const USERNAME = 'gh3sp'
const HOSTNAME = 'gh3os'

const DEFAULT_VFS: VfsNode = {
	type: 'dir',
	children: {
		home: {
			type: 'dir',
			children: {
				[USERNAME]: {
					type: 'dir',
					children: {
						'README.txt': { type: 'file', content: "Welcome to Gh3spOS shell. Type 'help'." },
					},
				},
			},
		},
		tmp: { type: 'dir', children: {} },
		etc: { type: 'dir', children: { 'os-release': { type: 'file', content: 'NAME=Gh3spOS' } } },
	},
}

const parseCommandLine = (line: string) => {
	const matches = line.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []
	return matches.map((part) => part.replace(/^['"]|['"]$/g, ''))
}

export const Terminal = ({ windowId }: { windowId: string }) => {
	const { apps, catalog, installApp, uninstallApp, setAppEnabled, isInstalled, isEnabled } = useApps()
	const packageIds = useMemo(() => catalog.map((item) => item.id), [catalog])
	const [output, setOutput] = usePersistentStore<string[]>('terminal:output', [
		'Gh3spOS Shell 1.0',
		`Logged in as ${USERNAME}@${HOSTNAME}`,
		"Type 'help' to list commands",
	])
	const [commands, setCommands] = usePersistentStore<string[]>('terminal:commands', [])
	const [cwd, setCwd] = usePersistentStore<string>('terminal:cwd', `/home/${USERNAME}`)
	const [vfs, setVfs] = usePersistentStore<VfsNode>('terminal:vfs', DEFAULT_VFS)

	const { openWindow, closeWindow, windows } = useWindowManager()
	const { widgets, removeWidget } = useWidgetManager()
	const { setWallpaper } = useWallpaper()
	const terminalMountRef = useRef<HTMLDivElement>(null)
	const termRef = useRef<XTerm | null>(null)
	const inputRef = useRef('')
	const cursorPosRef = useRef(0)
	const historyIndexRef = useRef(-1)

	const prompt = useMemo(() => {
		const displayPath = cwd === `/home/${USERNAME}` ? '~' : cwd.replace(`/home/${USERNAME}`, '~')
		return `${USERNAME}@${HOSTNAME}:${displayPath}$ `
	}, [cwd])

	const commandsRef = useRef(commands)
	const outputRef = useRef(output)
	const promptRef = useRef(prompt)
	const setCommandsRef = useRef(setCommands)
	const setOutputRef = useRef(setOutput)

	const context: TerminalContext = useMemo(() => ({
		apps,
		packageIds,
		installApp,
		uninstallApp,
		setAppEnabled,
		isInstalled,
		isEnabled,
		windows,
		windowId,
		widgets,
		removeWidget,
		openWindow,
		closeWindow,
		setWallpaper,
		setOutput,
		commands,
		setCommands,
		cwd,
		setCwd,
		vfs,
		setVfs,
	}), [apps, packageIds, installApp, uninstallApp, setAppEnabled, isInstalled, isEnabled, windows, windowId, widgets, removeWidget, openWindow, closeWindow, setWallpaper, setOutput, commands, setCommands, cwd, setCwd, vfs, setVfs])
	const contextRef = useRef(context)

	useEffect(() => {
		commandsRef.current = commands
	}, [commands])

	useEffect(() => {
		outputRef.current = output
	}, [output])

	useEffect(() => {
		promptRef.current = prompt
	}, [prompt])

	useEffect(() => {
		setCommandsRef.current = setCommands
	}, [setCommands])

	useEffect(() => {
		setOutputRef.current = setOutput
	}, [setOutput])

	useEffect(() => {
		contextRef.current = context
	}, [context])

	const getSuggestions = (input: string): string[] => {
		if (!input.trim()) return Object.keys(commandHandlers).sort()
		const parts = input.trim().split(' ')
		const cmd = parts[0]
		const args = parts.slice(1)

		if (parts.length === 1) {
			return Object.keys(commandHandlers).filter((c) => c.startsWith(cmd)).sort()
		}

		if (commandSuggestions[cmd]) return commandSuggestions[cmd](args, contextRef.current)
		return []
	}

	const applySuggestion = (input: string, suggestion: string): string => {
		const parts = input.trimEnd().split(' ')
		if (input.endsWith(' ')) return input + suggestion
		parts[parts.length - 1] = suggestion
		return parts.join(' ')
	}

	useEffect(() => {
		if (!terminalMountRef.current) return
		const mountEl = terminalMountRef.current

		const term = new XTerm({
			cursorBlink: true,
			fontSize: 14,
			fontFamily: 'JetBrains Mono, Cascadia Code, monospace',
			scrollback: 200,
			convertEol: true,
			theme: {
				background: '#00000000',
				foreground: '#d1fae5',
				cursor: '#34d399',
				selectionBackground: '#1f293780',
			},
		})

		const fitAddon = new FitAddon()
		term.loadAddon(fitAddon)
		term.open(mountEl)
		requestAnimationFrame(() => {
			fitAddon.fit()
			term.focus()
		})
		termRef.current = term

		const redrawInput = () => {
			term.write('\r\x1b[2K')
			term.write(promptRef.current + inputRef.current)
			const charsRight = inputRef.current.length - cursorPosRef.current
			if (charsRight > 0) {
				term.write(`\x1b[${charsRight}D`)
			}
		}

		const printPrompt = () => {
			term.write('\r\n' + promptRef.current)
		}

		const printOutput = (text: string) => {
			if (!text) return
			const lines = text.replace(/\r\n/g, '\n').split('\n')
			for (const outputLine of lines) {
				term.write('\r\n' + outputLine)
			}
		}

		const runCommand = async () => {
			const raw = inputRef.current.trim()
			const line = inputRef.current
			setCommandsRef.current((prev) => [...prev, line])
			historyIndexRef.current = -1

			if (!raw) {
				printPrompt()
				inputRef.current = ''
				cursorPosRef.current = 0
				return
			}

			const [cmd, ...args] = parseCommandLine(raw)
			setOutputRef.current((prev) => [...prev, `${promptRef.current}${line}`])

			if (!commandHandlers[cmd]) {
				const msg = `command not found: ${cmd}`
				setOutputRef.current((prev) => [...prev, msg])
				printOutput(msg)
				inputRef.current = ''
				cursorPosRef.current = 0
				printPrompt()
				return
			}

			try {
				const result = await commandHandlers[cmd](args, contextRef.current)
				if (cmd === 'clear') {
					term.clear()
					inputRef.current = ''
					cursorPosRef.current = 0
					term.write(promptRef.current)
					return
				}

				if (result) {
					setOutputRef.current((prev) => [...prev, result])
					printOutput(result)
				}
			} catch (err) {
				const msg = `error: ${String(err)}`
				setOutputRef.current((prev) => [...prev, msg])
				printOutput(msg)
			}

			inputRef.current = ''
			cursorPosRef.current = 0
			printPrompt()
		}

		for (const line of outputRef.current) term.writeln(line)
		term.write(promptRef.current)
		term.focus()

		const dataDisposable = term.onData((data) => {
			if (data === '\r') {
				void runCommand()
				return
			}

			if (data === '\u0003') {
				term.write('^C')
				inputRef.current = ''
				cursorPosRef.current = 0
				printPrompt()
				return
			}

			if (data === '\u000c') {
				term.clear()
				redrawInput()
				return
			}

			if (data === '\u007F') {
				if (!inputRef.current || cursorPosRef.current <= 0) return
				const left = inputRef.current.slice(0, cursorPosRef.current - 1)
				const right = inputRef.current.slice(cursorPosRef.current)
				inputRef.current = left + right
				cursorPosRef.current -= 1
				redrawInput()
				return
			}

			if (data === '\x1b[D') {
				if (cursorPosRef.current <= 0) return
				cursorPosRef.current -= 1
				redrawInput()
				return
			}

			if (data === '\x1b[C') {
				if (cursorPosRef.current >= inputRef.current.length) return
				cursorPosRef.current += 1
				redrawInput()
				return
			}

			if (data === '\x1b[A') {
				if (commandsRef.current.length === 0 || historyIndexRef.current >= commandsRef.current.length - 1) return
				historyIndexRef.current += 1
				inputRef.current = commandsRef.current[commandsRef.current.length - 1 - historyIndexRef.current] || ''
				cursorPosRef.current = inputRef.current.length
				redrawInput()
				return
			}

			if (data === '\x1b[B') {
				if (historyIndexRef.current <= 0) {
					historyIndexRef.current = -1
					inputRef.current = ''
					cursorPosRef.current = 0
					redrawInput()
					return
				}
				historyIndexRef.current -= 1
				inputRef.current = commandsRef.current[commandsRef.current.length - 1 - historyIndexRef.current] || ''
				cursorPosRef.current = inputRef.current.length
				redrawInput()
				return
			}

			if (data === '\t') {
				const suggestions = getSuggestions(inputRef.current)
				if (suggestions.length === 0) {
					term.write('\u0007')
					return
				}
				if (suggestions.length === 1) {
					inputRef.current = applySuggestion(inputRef.current, suggestions[0])
					cursorPosRef.current = inputRef.current.length
					redrawInput()
					return
				}
				term.write('\r\n' + suggestions.join('   '))
				redrawInput()
				return
			}

			if (data >= ' ' && data <= '~') {
				const left = inputRef.current.slice(0, cursorPosRef.current)
				const right = inputRef.current.slice(cursorPosRef.current)
				inputRef.current = left + data + right
				cursorPosRef.current += data.length
				redrawInput()
			}
		})

		let resizeRaf = 0
		const handleResize = () => {
			cancelAnimationFrame(resizeRaf)
			resizeRaf = requestAnimationFrame(() => {
				fitAddon.fit()
			})
		}

		window.addEventListener('resize', handleResize)
		const focusOnPointerDown = () => term.focus()
		mountEl.addEventListener('pointerdown', focusOnPointerDown)

		return () => {
			dataDisposable.dispose()
			window.removeEventListener('resize', handleResize)
			mountEl.removeEventListener('pointerdown', focusOnPointerDown)
			cancelAnimationFrame(resizeRaf)
			term.dispose()
		}
	}, [])

	return (
		<div className="relative h-full w-full p-0 gap-0 bg-white/[0.06] shadow-[0_18px_45px_rgba(0,0,0,0.45)] backdrop-blur-2xl overflow-hidden">
			<div ref={terminalMountRef} className="w-full h-full overflow-auto bg-black/10 custom-scroll" />
		</div>
	)
}
