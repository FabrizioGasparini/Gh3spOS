import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'

type TerminalProps = {
	onInput?: (input: string) => void
	onReady?: (term: XTerm) => void
}

const Terminal = ({ onInput, onReady }: TerminalProps) => {
	const terminalRef = useRef<HTMLDivElement>(null)
	const term = useRef<XTerm | null>(null)
	const fitAddon = useRef<FitAddon | null>(null)

	useEffect(() => {
		if (!terminalRef.current) return

		const terminal = new XTerm({
			cursorBlink: true,
			fontSize: 14,
			theme: {
				background: '#1e1e1e',
				foreground: '#ffffff',
			},
		})

		const fit = new FitAddon()
		if (terminalRef.current) {
			terminal.loadAddon(fit)
			terminal.open(terminalRef.current)
		}

		// Aspetta un attimo prima di fare il fit, così eviti crash
		setTimeout(() => {
			try {
				fit.fit()
			} catch (e) {
				console.warn('Initial fit failed:', e)
			}
		}, 100)

		// Resize dinamico e sicuro
		const handleResize = () => {
			try {
				if (terminalRef.current && fitAddon.current) {
					fitAddon.current.fit()
				}
			} catch (e) {
				console.warn('Fit failed on resize:', e)
			}
		}

		const observer = new ResizeObserver(handleResize)
		observer.observe(terminalRef.current)

		// Gestione input
		terminal.onData((data) => {
			if (onInput) onInput(data)
		})

		// Callback al padre
		if (onReady) onReady(terminal)

		// Salvataggio referenze
		term.current = terminal
		fitAddon.current = fit

		return () => {
			terminal.dispose()
			observer.disconnect()
		}
	}, [])

	return <div className="w-full h-[400px] bg-[#1e1e1e]" ref={terminalRef} />
}

export default Terminal
