import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePersistentStore } from '@/providers/persistent-store'
import { useAuth } from '@/providers/auth'
import { useApps } from '@/providers/apps'
import { useNotifications } from '@/providers/notifications'

const REMOTE_BROWSER_URL = 'http://localhost:7900/vnc.html?autoconnect=1&resize=scale&view_only=0&reconnect=1'
const DEFAULT_SECURE_BROWSER_URL = 'https://www.google.com'

type RemoteStatus = 'checking' | 'online' | 'offline'

type SecureBrowserResponse = {
	ok: boolean
	url?: string
	error?: string
}

const fetchSecureBrowser = async (path: string, init?: RequestInit): Promise<SecureBrowserResponse> => {
	const response = await fetch(`http://localhost:3001${path}`, {
		...init,
		headers: {
			'content-type': 'application/json',
			...(init?.headers || {}),
		},
	})

	const payload = await response.json().catch(() => ({})) as SecureBrowserResponse
	if (!response.ok || !payload?.ok) {
		throw new Error(payload?.error || 'Secure browser action failed')
	}

	return payload
}

export const BrowserApp: React.FC<{ windowId: string }> = () => {
	const { currentUser } = useAuth()
	const { canUsePermission } = useApps()
	const { notify } = useNotifications()
	const storagePrefix = useMemo(() => `browser:${currentUser?.id ?? 'default'}`, [currentUser?.id])
	const canUseNetwork = canUsePermission('browser', 'network')

	const [lastUrl, setLastUrl] = usePersistentStore<string>(`${storagePrefix}:secure-last-url`, DEFAULT_SECURE_BROWSER_URL)
	const [remoteStatus, setRemoteStatus] = useState<RemoteStatus>('checking')
	const [statusMessage, setStatusMessage] = useState('Connessione al Secure Browser in corso...')

	const remoteFailureCountRef = useRef(0)
	const hasOpenedDefaultRef = useRef(false)

	const syncCurrentUrl = useCallback(async () => {
		try {
			const payload = await fetchSecureBrowser('/secure-browser/current-url', { method: 'GET' })
			if (payload.url) {
				setLastUrl(payload.url)
			}
		} catch {
			// keep latest known URL in UI
		}
	}, [setLastUrl])

	const runAction = useCallback(async (path: string, body?: Record<string, unknown>) => {
		if (!canUseNetwork) {
			setRemoteStatus('offline')
			const message = 'Permesso negato: network disabilitato per Browser'
			setStatusMessage(message)
			if (canUsePermission('settings', 'notifications')) notify(message, 'warning')
			return
		}
		setStatusMessage('Esecuzione comando browser remoto...')
		try {
			const payload = await fetchSecureBrowser(path, {
				method: path === '/secure-browser/current-url' ? 'GET' : 'POST',
				body: body ? JSON.stringify(body) : undefined,
			})

			if (payload.url) {
				setLastUrl(payload.url)
			}

			setRemoteStatus('online')
			setStatusMessage('')
		} catch (error) {
			setRemoteStatus('offline')
			setStatusMessage(String(error instanceof Error ? error.message : error))
		}
	}, [canUseNetwork, canUsePermission, notify, setLastUrl])

	useEffect(() => {
		if (!canUseNetwork) {
			setRemoteStatus('offline')
			const message = 'Permesso negato: network disabilitato per Browser'
			setStatusMessage(message)
			if (canUsePermission('settings', 'notifications')) notify(message, 'warning')
			return
		}
		if (hasOpenedDefaultRef.current) return
		hasOpenedDefaultRef.current = true

		void (async () => {
			await runAction('/secure-browser/open-default', { url: lastUrl || DEFAULT_SECURE_BROWSER_URL })
			await syncCurrentUrl()
		})()
	}, [canUseNetwork, canUsePermission, notify, lastUrl, runAction, syncCurrentUrl])

	useEffect(() => {
		if (!canUseNetwork) return
		let disposed = false

		const checkRemote = async () => {
			try {
				await fetch(REMOTE_BROWSER_URL, { method: 'GET', mode: 'no-cors', cache: 'no-store' })
				remoteFailureCountRef.current = 0
				if (!disposed) {
					setRemoteStatus('online')
					setStatusMessage('')
				}
			} catch {
				remoteFailureCountRef.current += 1
				if (!disposed && remoteFailureCountRef.current >= 3) {
					setRemoteStatus('offline')
					setStatusMessage('Secure Browser remoto non raggiungibile. Avvia con npm run secure-browser:up')
				}
			}
		}

		void checkRemote()
		const timer = setInterval(() => { void checkRemote() }, 6000)
		return () => {
			disposed = true
			clearInterval(timer)
		}
	}, [canUseNetwork])

	return (
		<div className="h-full w-full bg-[#0a0f1d]/95 border border-white/15 rounded-xl overflow-hidden text-white">
			<div className="relative h-full w-full bg-black/20">
				{canUseNetwork && (
					<iframe
						src={REMOTE_BROWSER_URL}
						title="Selenium Remote Browser"
						className="absolute inset-0 w-full h-full"
					/>
				)}

				{(!canUseNetwork || remoteStatus !== 'online') && (
					<div className="absolute inset-0 z-10 grid place-items-center bg-black/55 backdrop-blur-[1px] p-6 text-center">
						<div className="space-y-2 max-w-xl">
							<p className="text-base text-white/90">{!canUseNetwork ? 'Browser bloccato dalla policy' : remoteStatus === 'checking' ? 'Connessione al browser remoto...' : 'Browser remoto non raggiungibile'}</p>
							<p className="text-xs text-white/65">{statusMessage || 'Controlla che il container Selenium sia attivo.'}</p>
							<button disabled={!canUseNetwork} onClick={() => void runAction('/secure-browser/open-default', { url: DEFAULT_SECURE_BROWSER_URL })} className="px-3 py-2 rounded-md bg-white/15 hover:bg-white/25 disabled:opacity-50 text-sm">
								Riprova connessione
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
