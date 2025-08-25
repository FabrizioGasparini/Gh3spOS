import { Component, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouteError } from 'react-router-dom'

interface Props {
	children: ReactNode
}
interface State {
	hasError: boolean
	error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props)
		this.state = { hasError: false, error: null }
	}

	static getDerivedStateFromError(error: Error) {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: unknown) {
		console.error('🧨 Caught by ErrorBoundary:', error, errorInfo)
	}

	reset = () => {
		this.setState({ hasError: false, error: null })
		location.reload()
	}

	render() {
		if (this.state.hasError && this.state.error) {
			return createPortal(
				<div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-md">
					<div className="bg-neutral-900 border border-red-500 text-white p-6 rounded-xl max-w-lg shadow-xl">
						<h2 className="text-red-400 text-xl font-semibold mb-2">Errore imprevisto 😵</h2>
						<p className="text-sm text-gray-300 whitespace-pre-wrap">
							{this.state.error.message}
						</p>
						<div className="mt-4 text-right">
							<button
								onClick={this.reset}
								className="bg-red-600 hover:bg-red-700 text-white py-1.5 px-4 rounded transition"
							>
								Ricarica pagina
							</button>
						</div>
					</div>
				</div>,
				document.body
			)
		}

		return this.props.children
	}
}

export const RouteErrorBoundary = () => {
  const error = useRouteError() as Error

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/ backdrop-blur-md z-50">
      <div className="bg-white/5 backdrop-blur-xl border border-white/20 text-white p-6 rounded-2xl shadow-2xl max-w-md w-[90%]">
        <h1 className="text-red-300 text-lg font-semibold mb-2">Errore nella pagina</h1>
        <p className="text-sm text-white/80 whitespace-pre-wrap break-words">
          {error.message || "Errore sconosciuto."}
        </p>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => location.reload()}
            className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg border border-red-500 transition-all"
          >
            🔄 Ricarica
          </button>
        </div>
      </div>
    </div>
  )
}