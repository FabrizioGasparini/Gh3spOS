import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

type TerminalProps = {
	onInput?: (input: string) => void
	onReady?: (term: XTerm) => void
}

const Terminal = ({ onInput, onReady }: TerminalProps) => {
	const terminalRef = useRef<HTMLDivElement>(null)
	const term = useRef<XTerm>(null)
	const fitAddon = useRef<FitAddon>()

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
		terminal.loadAddon(fit)
	
		terminal.open(terminalRef.current)
		terminal.write('Welcome to Gh3spOS SSH App\r\n$ ')
	
		if (onReady) onReady(terminal)
	
		const handleResize = () => {
			try {
				if (terminalRef.current?.clientHeight && terminalRef.current.clientHeight > 0) {
					fit.fit()
				}
			} catch (e) {
				console.warn("Fit failed", e)
			}
		}
	
		// Chiamata iniziale con ritardo (primo frame)
		requestAnimationFrame(() => {
			handleResize()
		})
	
		// Resize dinamico
		const observer = new ResizeObserver(() => {
			handleResize()
		})
		observer.observe(terminalRef.current)
	
		// Salva ref
		term.current = terminal
		fitAddon.current = fit
	
		terminal.onData((data) => {
			if (onInput) onInput(data)
		})
	
		return () => {
			terminal.dispose()
			observer.disconnect()
		}
	}, [onInput, onReady])
	

	return <div className="w-full h-[400px] bg-[#1e1e1e]" ref={terminalRef} />
}

export default Terminal
