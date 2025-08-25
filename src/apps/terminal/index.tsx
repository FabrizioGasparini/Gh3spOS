import { useState, useRef, useEffect } from 'react'
import { useWindowManager } from '@/providers/window-manager'
import { useWidgetManager } from '@/providers/widget-manager'
import { useWallpaper } from '@/providers/wallpaper'
import { usePersistentStore } from '@/providers/persistent-store'
import { apps } from '@/apps/definitions'
import clsx from 'clsx'
import { commandHandlers, commandSuggestions } from './commands'
import type { TerminalContext } from './types'

export const Terminal = ({ windowId }: { windowId: string }) => {
	const [input, setInput] = useState('')
	const [output, setOutput] = usePersistentStore<string[]>('terminal:output', [])
	const [commands, setCommands] = usePersistentStore<string[]>('terminal:commands', [])
	const [commandIndex, setCommandIndex] = useState(0)
	const [suggestion, setSuggestion] = useState<string | null>(null)

	const { openWindow, closeWindow, windows } = useWindowManager()
	const { widgets, removeWidget } = useWidgetManager()
	const { setWallpaper } = useWallpaper()

	const endRef = useRef<HTMLDivElement>(null)

	const context: TerminalContext = {
		apps,
		windows,
		windowId,
		widgets,
		removeWidget,
		openWindow,
		closeWindow,
		setWallpaper,
		setOutput,
		commands,
		setCommands
	}

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [output])

	useEffect(() => {
		const suggestions = getSuggestions(input, context)
		setSuggestion(suggestions[0] || null)
	}, [input])

	function getSuggestions(input: string, context: TerminalContext): string[] {
		if (!input.trim()) return []

		const parts = input.trim().split(' ')
		const cmd = parts[0]
		const args = parts.slice(1)

		if (parts.length === 1) {
			return Object.keys(commandHandlers).filter(c => c.startsWith(cmd))
		}

		if (commandSuggestions[cmd]) {
			return commandSuggestions[cmd](args, context)
		}

		return []
	}

	const handleCommand = async () => {
		const [cmd, ...args] = input.trim().split(' ')
		let result = ''

		if (commandHandlers[cmd]) {
			try {
			result = await commandHandlers[cmd](args, context)
			} catch (err) {
			result = `❌ Error executing command '${cmd}': ${String(err)}`
			}
		} else {
			result = `❓ Unknown command: ${cmd}`
		}

		setCommands(prev => [...prev, input])
		if (cmd !== 'clear') setOutput(prev => [...prev, `$ ${input}`, result])
		setInput('')
		setSuggestion(null)
	}

	function applySuggestion(input: string, suggestion: string): string {
		const parts = input.trimEnd().split(' ')
		if (input.endsWith(' ')) {
			return input + suggestion
		} else {
			parts[parts.length - 1] = suggestion
			return parts.join(' ')
		}
}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') return handleCommand()
		if (e.key === 'ArrowUp') {
			if (commands.length > 0 && commandIndex < commands.length - 1) {
				setCommandIndex(commandIndex + 1)
				setInput(commands[commands.length - 1 - commandIndex])
			}
		}
		if (e.key === 'ArrowDown') {
			if (commandIndex > 0) {
				setCommandIndex(commandIndex - 1)
				setInput(commands[commands.length - 1 - commandIndex])
			} else {
				setCommandIndex(0)
				setInput('')
			}
		}
		if (e.key === 'Tab' && suggestion) {
			e.preventDefault()
			setInput(applySuggestion(input, suggestion))
		}
	}

	return (
		<div className="relative h-full w-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl flex flex-col overflow-hidden">

			{/* Output */}
			<div className="flex-1 overflow-y-auto p-4 font-mono text-green-300 text-sm leading-relaxed custom-scroll">
				{output.map((line, i) => (
					<pre key={i} className="whitespace-pre-wrap">{line}</pre>
				))}
				<div ref={endRef} />
			</div>

			{/* Prompt */}
			<div className="border-t border-white/10 px-4 py-2 bg-white/5 flex items-center gap-2 text-green-400 ">
				<span className="text-white font-bold select-none">$</span>
				<input
					className={clsx(
						'flex-1 bg-transparent outline-none border-none',
						'text-green-200 placeholder:text-green-500 font-mono text-sm'
					)}
					placeholder="Type a command..."
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					autoFocus
				/>
				{suggestion && (
					<span className="text-xs text-white/40 ml-2">{suggestion}</span>
				)}
			</div>
		</div>
	)
}
