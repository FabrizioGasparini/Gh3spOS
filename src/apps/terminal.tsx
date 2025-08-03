import { useState, useRef, useEffect } from 'react'
import { useWindowManager } from '@/providers/window-manager'
import { useWidgetManager } from '@/providers/widget-manager'
import { useWallpaper } from '@/providers/wallpaper'
import { apps } from '@/apps/definitions'
import clsx from 'clsx'

export const Terminal = ({ windowId }: { windowId: string }) => {
	const [input, setInput] = useState('')
	const [output, setOutput] = useState<string[]>([])
	const terminalEndRef = useRef<HTMLDivElement>(null)

	const { openWindow, closeWindow, windows } = useWindowManager()
	const { widgets } = useWidgetManager()
	const { setWallpaper } = useWallpaper()

	const handleCommand = () => {
		const [cmd, ...args] = input.trim().split(' ')
		let result = ''

		switch (cmd) {
			case 'start':
				if (apps.has(args[0])) {
					openWindow(apps.get(args[0])!, args[0])
					result = `✅ Opened ${args[0]}`
				} else result = `❌ Unknown app: ${args[0]}`
				break
			case 'kill':
				if (windows.some(w => w.id === args[0])) {
					closeWindow(args[0])
					result = `✅ Closed window ${args[0]}`
				} else result = `❌ No window found with ID ${args[0]}`
				break
			case 'list':
                switch (args[0]) {
                    case 'windows':
                        if (windows.length === 0) result = "No windows open"
                        else result = `🪟 Windows:\n${windows.map(w => `- ${w.appId} | ${w.id}`).join('\n')}`
                        break
                    case 'widgets':
                        if(widgets.length === 0) result = "No widgets available"
                        else result = `🧩 Widgets:\n${widgets.map(w => `- ${w.id}`).join('\n')}`
                        break
                    
                    default:
                        result = `❓ Unknown list type: ${args[0]}`
                }
                break
            
			case 'set':
				if (args[0] === 'wallpaper' && args[1]) {
					setWallpaper(args[1])
					result = `🖼️ Wallpaper set to ${args[1]}`
				}
                break
            case 'clear':
                setInput('')
                setOutput([])
                break
            
            case 'exit':
                closeWindow(windowId)
                break
            
			case 'help':
				result = `📖 Available commands:\n• start <app>\n• kill <windowId>\n• list windows\n• list widgets\n• set wallpaper <url>\n• help`
				break
			default:
				result = `❓ Unknown command: ${cmd}`
		}

		setOutput(prev => [...prev, `$ ${input}`, result])
		setInput('')
	}

	// Scroll to bottom on output change
	useEffect(() => {
		terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [output])

	return (
		<div className="h-full w-full p-4 bg-white/5 backdrop-blur-lg border border-white/20 rounded-2xl text-green-300 font-mono text-sm leading-snug flex flex-col overflow-hidden custom-scroll">
			<div className="flex-1 overflow-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
				{output.map((line, i) => (
					<pre key={i} className="whitespace-pre-wrap text-green-200">
						{line}
					</pre>
				))}
				<div ref={terminalEndRef} />
			</div>

			{/* Prompt */}
			<div className="mt-4 flex items-center gap-2 text-green-400">
				<span className="text-white">$</span>
				<input
					className={clsx(
						'w-full bg-transparent border-none outline-none placeholder:text-green-600',
						'text-green-300 font-mono text-sm leading-snug'
					)}
					placeholder="Type a command... (try: help)"
					value={input}
					onChange={e => setInput(e.target.value)}
					onKeyDown={e => {
						if (e.key === 'Enter') handleCommand()
					}}
					autoFocus
				/>
			</div>
		</div>
	)
}
