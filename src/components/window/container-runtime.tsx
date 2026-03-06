import { useEffect, useMemo, useState } from 'react'

type ContainerRuntimeProps = {
	endpoint: string
	fallbackComponent: React.ComponentType<Record<string, unknown>>
	fallbackProps: Record<string, unknown>
}

type RuntimeMode = 'checking' | 'remote' | 'fallback'

export const ContainerRuntime = ({ endpoint, fallbackComponent: FallbackComponent, fallbackProps }: ContainerRuntimeProps) => {
	const [mode, setMode] = useState<RuntimeMode>('checking')

	const normalizedEndpoint = useMemo(() => endpoint.replace(/\/$/, ''), [endpoint])

	useEffect(() => {
		let cancelled = false
		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), 2500)

		const checkEndpoint = async () => {
			try {
				await fetch(normalizedEndpoint, {
					method: 'GET',
					mode: 'no-cors',
					cache: 'no-store',
					signal: controller.signal,
				})
				if (!cancelled) setMode('remote')
			} catch {
				if (!cancelled) setMode('fallback')
			} finally {
				clearTimeout(timeout)
			}
		}

		void checkEndpoint()

		return () => {
			cancelled = true
			controller.abort()
			clearTimeout(timeout)
		}
	}, [normalizedEndpoint])

	if (mode === 'checking') {
		return (
			<div className="h-full w-full grid place-items-center text-white/75 text-sm bg-black/20">
				Verifica endpoint servizio in corso...
			</div>
		)
	}

	if (mode === 'remote') {
		return (
			<iframe
				src={normalizedEndpoint}
				className="h-full w-full border-0"
				sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-pointer-lock allow-modals"
				title="Container App Runtime"
			/>
		)
	}

	return <FallbackComponent {...fallbackProps} />
}
