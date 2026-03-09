import { useEffect, useMemo, useRef, useState } from 'react'
import { useWindowManager } from '@/providers/window-manager'
import { useWidgetManager } from '@/providers/widget-manager'
import { useWallpaper } from '@/providers/wallpaper'
import { usePersistentStore } from '@/providers/persistent-store'
import { useApps } from '@/providers/apps'
import { commandHandlers, commandSuggestions, getPathCompletionsForInput } from './commands.ts'
import type { FsNodeMeta, TerminalContext } from './types'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { useAuth } from '@/providers/auth'

const SUDO_TIMEOUT_MS = 5 * 60 * 1000

type SudoChallenge = {
	mode: 'command' | 'validate' | 'list' | 'shell'
	command?: string
	args?: string[]
	attempts: number
}

const ROOT_META_DEFAULTS: Record<string, FsNodeMeta> = {
	'/': { owner: 'root', mode: 0o755, type: 'folder' },
	'/etc': { owner: 'root', mode: 0o755, type: 'folder' },
	'/var': { owner: 'root', mode: 0o755, type: 'folder' },
	'/root': { owner: 'root', mode: 0o700, type: 'folder' },
	'/system': { owner: 'root', mode: 0o755, type: 'folder' },
}

const parseCommandLine = (line: string) => {
	const matches = line.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []
	return matches.map((part) => part.replace(/^['"]|['"]$/g, ''))
}

export const Terminal = ({ windowId }: { windowId: string }) => {
	return <TerminalTabs windowId={windowId} />
}

const TerminalSession = ({ windowId, sessionId }: { windowId: string; sessionId: string }) => {
	const { apps, catalog, installApp, uninstallApp, setAppEnabled, isInstalled, isEnabled, canUsePermission } = useApps()
	const { currentUser } = useAuth()

	const USERNAME = currentUser?.username || 'gh3sp'
	const HOSTNAME = 'gh3spos'

	const storePrefix = `terminal:${windowId}:${sessionId}`

	const packageIds = useMemo(() => catalog.map((item) => item.id), [catalog])
	const [output, setOutput] = usePersistentStore<string[]>(`${storePrefix}:output`, [
		'Gh3spOS Shell 1.0',
		`Logged in as ${USERNAME}@${HOSTNAME}`,
		"Cloud FS mounted at '/'",
		"Type 'help' to list commands",
	])
	const [commands, setCommands] = usePersistentStore<string[]>(`${storePrefix}:commands`, [])
	const [cwd, setCwd] = usePersistentStore<string>(`${storePrefix}:cwd`, '/')
	const [isRoot, setIsRoot] = usePersistentStore<boolean>(`${storePrefix}:is-root`, false)
	const [rootPassword, setRootPassword] = usePersistentStore<string>(`${storePrefix}:root-password`, 'gh3sp-root')
	const [sudoAuthUntil, setSudoAuthUntil] = usePersistentStore<number>(`${storePrefix}:sudo-auth-until`, 0)
	const [rootHintShown, setRootHintShown] = usePersistentStore<boolean>(`${storePrefix}:root-hint-shown`, false)
	const [sudoChallenge, setSudoChallenge] = usePersistentStore<SudoChallenge | null>(`${storePrefix}:sudo-challenge`, null)
	const [fsMeta, setFsMeta] = usePersistentStore<Record<string, FsNodeMeta>>(`${storePrefix}:fs-meta`, ROOT_META_DEFAULTS)
	const safeFsMeta = useMemo<Record<string, FsNodeMeta>>(() => {
		if (!fsMeta || typeof fsMeta !== 'object' || Array.isArray(fsMeta)) return ROOT_META_DEFAULTS
		return fsMeta
	}, [fsMeta])

	const { openWindow, closeWindow, windows } = useWindowManager()
	const { widgets, removeWidget } = useWidgetManager()
	const { setWallpaper } = useWallpaper()
	const terminalMountRef = useRef<HTMLDivElement>(null)
	const termRef = useRef<XTerm | null>(null)
	const sshSocketRef = useRef<WebSocket | null>(null)
	const sshConnectedRef = useRef(false)
	const sshConnectingRef = useRef(false)
	const inputRef = useRef('')
	const cursorPosRef = useRef(0)
	const historyIndexRef = useRef(-1)
	const sudoChallengeRef = useRef<SudoChallenge | null>(sudoChallenge)
	const sudoAuthUntilRef = useRef<number>(sudoAuthUntil)

	const isSshSessionActive = () => Boolean(sshSocketRef.current)

	const sendSshInput = (data: string) => {
		const socket = sshSocketRef.current
		if (!socket || socket.readyState !== WebSocket.OPEN) return
		socket.send(JSON.stringify({ type: 'input', data }))
	}

	const stopSshSession = () => {
		const socket = sshSocketRef.current
		if (!socket) return
		sshSocketRef.current = null
		sshConnectedRef.current = false
		sshConnectingRef.current = false
		try {
			if (socket.readyState === WebSocket.OPEN) {
				socket.send(JSON.stringify({ type: 'disconnect' }))
			}
		} catch {
			// ignore send errors while disconnecting
		}
		try {
			socket.close()
		} catch {
			// ignore close errors
		}
	}

	const startSshSession = async (config: { host: string; port: number; username: string; password: string }) => {
		if (sshSocketRef.current) {
			return 'ssh: session already active (use Ctrl+] to exit)'
		}

		const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
		const wsHost = window.location.hostname || 'localhost'
		const socket = new WebSocket(`${wsProtocol}://${wsHost}:3001`)
		sshSocketRef.current = socket
		sshConnectingRef.current = true
		sshConnectedRef.current = false

		socket.onopen = () => {
			socket.send(JSON.stringify({
				type: 'connect',
				host: config.host,
				port: config.port,
				username: config.username,
				password: config.password,
			}))
		}

		socket.onmessage = (message) => {
			const term = termRef.current
			if (!term) return

			try {
				const payload = JSON.parse(String(message.data)) as { type?: string; data?: string; message?: string }
				if (payload.type === 'output') {
					sshConnectedRef.current = true
					sshConnectingRef.current = false
					term.write(payload.data || '')
					return
				}
				if (payload.type === 'status') {
					const statusText = String(payload.message || '')
					if ((payload.message || '').toLowerCase().includes('riuscita')) {
						sshConnectedRef.current = true
						sshConnectingRef.current = false
					}
					if (/chiusa|disconnesso|closed/i.test(statusText)) {
						sshSocketRef.current = null
						sshConnectedRef.current = false
						sshConnectingRef.current = false
					}
					term.writeln(`\r\n[ssh] ${statusText || 'status update'}`)
					if (/chiusa|disconnesso|closed/i.test(statusText)) {
						term.write(`${promptRef.current}`)
					}
					return
				}
				term.write(String(message.data))
			} catch {
				term.write(String(message.data))
			}
		}

		socket.onerror = () => {
			const term = termRef.current
			if (!term) return
			const backendHint = wsProtocol === 'wss'
				? 'backend SSH non raggiungibile via WSS su :3001 (verifica TLS/reverse-proxy).'
				: "backend SSH non raggiungibile (avvia 'npm run server')."
			term.writeln(`\r\n[ssh] websocket error: ${backendHint}`)
		}

		socket.onclose = () => {
			const term = termRef.current
			const hadActiveSession = sshConnectedRef.current || sshConnectingRef.current
			if (sshSocketRef.current === socket) {
				sshSocketRef.current = null
			}
			sshConnectedRef.current = false
			sshConnectingRef.current = false
			if (!term || !hadActiveSession) return
			term.writeln('\r\n[ssh] session closed')
			term.write(`${promptRef.current}`)
		}

		return `ssh: connecting to ${config.username}@${config.host}:${config.port} (Ctrl+] to exit)`
	}

	const prompt = useMemo(() => {
		if (sudoChallenge && !isRoot) {
			return `[sudo] password for ${USERNAME}: `
		}
		const userHome = `/home/${USERNAME}`
		const displayPath = cwd === userHome ? '~' : cwd.replace(userHome, '~')
		const identity = isRoot ? 'root' : USERNAME
		const promptChar = isRoot ? '#' : '$'
		return `${identity}@${HOSTNAME}:${displayPath}${promptChar} `
	}, [sudoChallenge, isRoot, USERNAME, cwd])

	const commandsRef = useRef(commands)
	const outputRef = useRef(output)
	const promptRef = useRef(prompt)
	const setCommandsRef = useRef(setCommands)
	const setOutputRef = useRef(setOutput)

	const context: TerminalContext = useMemo(() => ({
		username: USERNAME,
		hostname: HOSTNAME,
		userHome: `/home/${USERNAME}`,
		isRoot,
		setIsRoot,
		rootPassword,
		setRootPassword,
		apps,
		packageIds,
		installApp,
		uninstallApp,
		setAppEnabled,
		isInstalled,
		isEnabled,
		canUsePermission,
		startSshSession,
		stopSshSession,
		isSshSessionActive,
		sendSshInput,
		windows,
		windowId,
		widgets,
		removeWidget,
		openWindow,
		closeWindow,
		setWallpaper,
		currentUser,
		setOutput,
		commands,
		setCommands,
		cwd,
		setCwd,
		fsMeta: safeFsMeta,
		setFsMeta,
	}), [USERNAME, HOSTNAME, isRoot, setIsRoot, rootPassword, setRootPassword, apps, packageIds, installApp, uninstallApp, setAppEnabled, isInstalled, isEnabled, canUsePermission, windows, windowId, widgets, removeWidget, openWindow, closeWindow, setWallpaper, currentUser, setOutput, commands, setCommands, cwd, setCwd, safeFsMeta, setFsMeta])
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

	useEffect(() => {
		sudoChallengeRef.current = sudoChallenge
	}, [sudoChallenge])

	useEffect(() => {
		sudoAuthUntilRef.current = sudoAuthUntil
	}, [sudoAuthUntil])

	useEffect(() => {
		if (!cwd.startsWith('/') || cwd === '/home' || cwd.startsWith('/home/')) {
			setCwd('/')
		}
	}, [cwd, setCwd])

	useEffect(() => {
		if (!fsMeta || typeof fsMeta !== 'object' || Array.isArray(fsMeta)) {
			setFsMeta(ROOT_META_DEFAULTS)
			return
		}
		const missingRootDefaults = Object.entries(ROOT_META_DEFAULTS).some(([path, meta]) => {
			const current = (fsMeta && typeof fsMeta === 'object' && !Array.isArray(fsMeta)) ? fsMeta[path] : undefined
			return !current || current.type !== meta.type
		})
		if (missingRootDefaults) {
			setFsMeta((prev) => ({ ...ROOT_META_DEFAULTS, ...(prev || {}) }))
		}
	}, [fsMeta, setFsMeta])

	useEffect(() => {
		if (rootHintShown) return
		setOutput((prev) => {
			if (prev.some((line) => line.includes('Root quick tips'))) return prev
			return [
				...prev,
				'Root quick tips:',
				"- su <password>        entra in root",
				"- sudo <cmd>           esegue comando con privilegi root",
				"- sudo -k|-v|-l|-s     controlli avanzati sudo",
				"- passwd <newPass>     cambia password root",
				"- deauth               torna utente normale",
			]
		})
		setRootHintShown(true)
	}, [rootHintShown, setOutput, setRootHintShown])

	const getSuggestions = async (input: string): Promise<string[]> => {
		const pathCompletions = await getPathCompletionsForInput(input, contextRef.current)
		if (pathCompletions.length) return pathCompletions

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
		const fitTerminal = () => {
			try {
				fitAddon.fit()
			} catch {
				// ignore transient layout timing issues
			}
		}

		requestAnimationFrame(() => {
			fitTerminal()
			requestAnimationFrame(() => fitTerminal())
			term.focus()
		})
		const delayedFitA = window.setTimeout(() => fitTerminal(), 120)
		const delayedFitB = window.setTimeout(() => fitTerminal(), 360)
		termRef.current = term

		const getLivePrompt = () => {
			if (sudoChallengeRef.current && !contextRef.current.isRoot) {
				return `[sudo] password for ${USERNAME}: `
			}
			const userHome = `/home/${USERNAME}`
			const currentCwd = contextRef.current.cwd
			const displayPath = currentCwd === userHome ? '~' : currentCwd.replace(userHome, '~')
			const identity = contextRef.current.isRoot ? 'root' : USERNAME
			const promptChar = contextRef.current.isRoot ? '#' : '$'
			return `${identity}@${HOSTNAME}:${displayPath}${promptChar} `
		}

		const redrawInput = () => {
			term.write('\r\x1b[2K')
			const visualInput = sudoChallengeRef.current ? '' : inputRef.current
			term.write(getLivePrompt() + visualInput)
			const charsRight = visualInput.length - cursorPosRef.current
			if (!sudoChallengeRef.current && charsRight > 0) {
				term.write(`\x1b[${charsRight}D`)
			}
		}

		const printPrompt = () => {
			term.write('\r\n' + getLivePrompt())
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

			const executeParsed = async (commandName: string, commandArgs: string[], asRoot = false) => {
				const handler = commandHandlers[commandName]
				if (!handler) return { error: `command not found: ${commandName}` }
				const runContext = asRoot ? { ...contextRef.current, isRoot: true } : contextRef.current
				try {
					const result = await handler(commandArgs, runContext)
					if (commandName === 'clear') return { clear: true, output: '' }
					return { output: result }
				} catch (err) {
					return { error: `error: ${String(err)}` }
				}
			}

			const activeSudoChallenge = sudoChallengeRef.current
			if (activeSudoChallenge && !contextRef.current.isRoot) {
				const supplied = line
				if (supplied === contextRef.current.rootPassword) {
					const nextAuthUntil = Date.now() + SUDO_TIMEOUT_MS
					setSudoAuthUntil(nextAuthUntil)
					sudoAuthUntilRef.current = nextAuthUntil
					const challenge = activeSudoChallenge
					setSudoChallenge(null)
					sudoChallengeRef.current = null
					inputRef.current = ''
					cursorPosRef.current = 0

					if (challenge.mode === 'validate') {
						printPrompt()
						return
					}

					if (challenge.mode === 'list') {
						const msg = `User ${USERNAME} may run all commands on ${HOSTNAME}`
						setOutputRef.current((prev) => [...prev, msg])
						printOutput(msg)
						printPrompt()
						return
					}

					if (challenge.mode === 'shell') {
						contextRef.current.setIsRoot(true)
						printPrompt()
						return
					}

					if (challenge.mode === 'command' && challenge.command) {
						const result = await executeParsed(challenge.command, challenge.args || [], true)
						if (result.clear) {
							term.write('\r\n')
							term.clear()
							term.write(getLivePrompt())
							return
						}
						if (result.error) {
							setOutputRef.current((prev) => [...prev, result.error])
							printOutput(result.error)
						} else if (result.output) {
							setOutputRef.current((prev) => [...prev, result.output])
							printOutput(result.output)
						}
						printPrompt()
						return
					}

					printPrompt()
					return
				}

				const nextAttempts = (activeSudoChallenge.attempts || 0) + 1
				if (nextAttempts >= 3) {
					setSudoChallenge(null)
					sudoChallengeRef.current = null
					inputRef.current = ''
					cursorPosRef.current = 0
					const msg = 'sudo: 3 incorrect password attempts'
					setOutputRef.current((prev) => [...prev, msg])
					printOutput(msg)
					printPrompt()
					return
				}

				const nextChallenge = { ...activeSudoChallenge, attempts: nextAttempts }
				setSudoChallenge(nextChallenge)
				sudoChallengeRef.current = nextChallenge
				inputRef.current = ''
				cursorPosRef.current = 0
				const msg = 'Sorry, try again.'
				setOutputRef.current((prev) => [...prev, msg])
				printOutput(msg)
				printPrompt()
				return
			}

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

			if (cmd === 'sudo') {
				const hasCachedAuth = contextRef.current.isRoot || Date.now() < sudoAuthUntilRef.current
				const option = args[0]

				if (option === '-k') {
					setSudoAuthUntil(0)
					sudoAuthUntilRef.current = 0
					setSudoChallenge(null)
					sudoChallengeRef.current = null
					inputRef.current = ''
					cursorPosRef.current = 0
					printPrompt()
					return
				}

				if (option === '-v') {
					if (!hasCachedAuth) {
						const nextChallenge = { mode: 'validate', attempts: 0 } as SudoChallenge
						setSudoChallenge(nextChallenge)
						sudoChallengeRef.current = nextChallenge
					}
					inputRef.current = ''
					cursorPosRef.current = 0
					printPrompt()
					return
				}

				if (option === '-l') {
					if (hasCachedAuth) {
						const msg = `User ${USERNAME} may run all commands on ${HOSTNAME}`
						setOutputRef.current((prev) => [...prev, msg])
						printOutput(msg)
						inputRef.current = ''
						cursorPosRef.current = 0
						printPrompt()
						return
					}
					const nextChallenge = { mode: 'list', attempts: 0 } as SudoChallenge
					setSudoChallenge(nextChallenge)
					sudoChallengeRef.current = nextChallenge
					inputRef.current = ''
					cursorPosRef.current = 0
					printPrompt()
					return
				}

				if (option === '-s') {
					if (hasCachedAuth) {
						contextRef.current.setIsRoot(true)
						inputRef.current = ''
						cursorPosRef.current = 0
						printPrompt()
						return
					}
					const nextChallenge = { mode: 'shell', attempts: 0 } as SudoChallenge
					setSudoChallenge(nextChallenge)
					sudoChallengeRef.current = nextChallenge
					inputRef.current = ''
					cursorPosRef.current = 0
					printPrompt()
					return
				}

				if (!args[0]) {
					const msg = "usage: sudo [-k] [-v] [-l] [-s] <command> [args...]"
					setOutputRef.current((prev) => [...prev, msg])
					printOutput(msg)
					inputRef.current = ''
					cursorPosRef.current = 0
					printPrompt()
					return
				}

				const sudoCommand = args[0]
				const sudoArgs = args.slice(1)

				if (hasCachedAuth) {
					const result = await executeParsed(sudoCommand, sudoArgs, true)
					if (result.clear) {
						term.write('\r\n')
						term.clear()
						inputRef.current = ''
						cursorPosRef.current = 0
						term.write(getLivePrompt())
						return
					}
					if (result.error) {
						setOutputRef.current((prev) => [...prev, result.error])
						printOutput(result.error)
					} else if (result.output) {
						setOutputRef.current((prev) => [...prev, result.output])
						printOutput(result.output)
					}
					inputRef.current = ''
					cursorPosRef.current = 0
					printPrompt()
					return
				}

				const nextChallenge = { mode: 'command', command: sudoCommand, args: sudoArgs, attempts: 0 } as SudoChallenge
				setSudoChallenge(nextChallenge)
				sudoChallengeRef.current = nextChallenge
				inputRef.current = ''
				cursorPosRef.current = 0
				printPrompt()
				return
			}

			const result = await executeParsed(cmd, args)
			if (result.clear) {
				term.write('\r\n')
				term.clear()
				inputRef.current = ''
				cursorPosRef.current = 0
				term.write(getLivePrompt())
				return
			}

			if (result.error) {
				setOutputRef.current((prev) => [...prev, result.error])
				printOutput(result.error)
			} else if (result.output) {
				setOutputRef.current((prev) => [...prev, result.output])
				printOutput(result.output)
			}

			inputRef.current = ''
			cursorPosRef.current = 0
			printPrompt()
		}

		for (const line of outputRef.current) term.writeln(line)
		term.write(getLivePrompt())
		term.focus()

		const dataDisposable = term.onData((data) => {
			if (contextRef.current.isSshSessionActive()) {
				if (data === '\u001d') {
					contextRef.current.stopSshSession()
					term.writeln('\r\n[ssh] terminated by user')
					term.write(getLivePrompt())
					return
				}
				contextRef.current.sendSshInput(data)
				return
			}

			if (data === '\r') {
				void runCommand()
				return
			}

			if (data === '\u0003') {
				term.write('^C')
				setSudoChallenge(null)
				sudoChallengeRef.current = null
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
				if (sudoChallengeRef.current) return
				if (cursorPosRef.current <= 0) return
				cursorPosRef.current -= 1
				redrawInput()
				return
			}

			if (data === '\x1b[C') {
				if (sudoChallengeRef.current) return
				if (cursorPosRef.current >= inputRef.current.length) return
				cursorPosRef.current += 1
				redrawInput()
				return
			}

			if (data === '\x1b[A') {
				if (sudoChallengeRef.current) return
				if (commandsRef.current.length === 0 || historyIndexRef.current >= commandsRef.current.length - 1) return
				historyIndexRef.current += 1
				inputRef.current = commandsRef.current[commandsRef.current.length - 1 - historyIndexRef.current] || ''
				cursorPosRef.current = inputRef.current.length
				redrawInput()
				return
			}

			if (data === '\x1b[B') {
				if (sudoChallengeRef.current) return
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
				if (sudoChallengeRef.current) return
				void (async () => {
					const suggestions = await getSuggestions(inputRef.current)
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
				})()
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
				fitTerminal()
			})
		}

		const resizeObserver = new ResizeObserver(() => {
			handleResize()
		})
		resizeObserver.observe(mountEl)

		window.addEventListener('resize', handleResize)
		const focusOnPointerDown = () => term.focus()
		mountEl.addEventListener('pointerdown', focusOnPointerDown)

		return () => {
			stopSshSession()
			dataDisposable.dispose()
			window.removeEventListener('resize', handleResize)
			resizeObserver.disconnect()
			mountEl.removeEventListener('pointerdown', focusOnPointerDown)
			window.clearTimeout(delayedFitA)
			window.clearTimeout(delayedFitB)
			cancelAnimationFrame(resizeRaf)
			term.dispose()
		}
	}, [])

	return (
		<div className="relative h-full w-full p-0 gap-0 backdrop-blur-lg overflow-hidden">
			<div ref={terminalMountRef} className="w-full h-full overflow-auto custom-scroll" />
		</div>
	)
}

type TerminalTab = {
	id: string
	label: string
}

const TerminalTabs = ({ windowId }: { windowId: string }) => {
	const [tabs, setTabs] = useState<TerminalTab[]>([{ id: 'tab-1', label: 'Tab 1' }])
	const [activeTabId, setActiveTabId] = useState('tab-1')
	const nextTabRef = useRef(2)

	const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0], [tabs, activeTabId])

	const addTab = () => {
		const index = nextTabRef.current
		nextTabRef.current += 1
		const newTab = { id: `tab-${index}`, label: `Tab ${index}` }
		setTabs((prev) => [...prev, newTab])
		setActiveTabId(newTab.id)
	}

	const closeTab = (tabId: string) => {
		setTabs((prev) => {
			if (prev.length <= 1) return prev
			const next = prev.filter((tab) => tab.id !== tabId)
			if (activeTabId === tabId) {
				setActiveTabId(next[next.length - 1]?.id || next[0]?.id || 'tab-1')
			}
			return next
		})
	}

	if (!activeTab) return null

	return (
		<div className="h-full w-full flex flex-col overflow-hidden bg-white/[0.06] backdrop-blur-2xl">
			<div className="h-9 shrink-0 flex items-center gap-1 px-2 border-b border-white/10 bg-black/20">
				{tabs.map((tab) => {
					const isActive = tab.id === activeTab.id
					return (
						<div
							key={tab.id}
							className={`group inline-flex items-center gap-2 px-3 h-7 rounded-md text-xs cursor-pointer transition ${isActive ? 'bg-emerald-500/25 text-emerald-100 border border-emerald-300/30' : 'bg-white/5 text-white/75 hover:bg-white/10'}`}
							onClick={() => setActiveTabId(tab.id)}
						>
							<span>{tab.label}</span>
							{tabs.length > 1 ? (
								<button
									type="button"
									onClick={(event) => {
										event.stopPropagation()
										closeTab(tab.id)
									}}
									className="h-4 w-4 rounded-sm text-white/70 hover:text-white hover:bg-white/10"
								>
									×
								</button>
							) : null}
						</div>
					)
				})}
				<button
					type="button"
					onClick={addTab}
					className="ml-auto h-7 px-2 rounded-md text-sm text-white/80 hover:text-white bg-white/5 hover:bg-white/10"
				>
					+
				</button>
			</div>
			<div className="min-h-0 flex-1">
				<TerminalSession key={activeTab.id} windowId={windowId} sessionId={activeTab.id} />
			</div>
		</div>
	)
}
