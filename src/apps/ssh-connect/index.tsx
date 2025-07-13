import Terminal from '@/components/terminal/index'
import { useSSH } from '@/hooks/useSSH'
import { useState } from 'react'

export const SSHConnectApp = () => {
	const [connected, setConnected] = useState(false)
	const [output, setOutput] = useState('')
	const [form, setForm] = useState({ host: '', username: '', password: '' })

	const { connect, sendCommand } = useSSH(
		(data) => setOutput((prev) => prev + data),
		(status) => {
			console.log(status)
			setConnected(true)
		}
	)

	const handleConnect = () => {
		connect({ ...form })
	}

	return (
		<div className="w-full h-full flex flex-col bg-zinc-900 text-white">
			{!connected ? (
				<div className="p-4 space-y-2">
					<input
						className="bg-zinc-800 p-2 w-full rounded"
						placeholder="Host"
						onChange={(e) => setForm({ ...form, host: e.target.value })}
					/>
					<input
						className="bg-zinc-800 p-2 w-full rounded"
						placeholder="Username"
						onChange={(e) => setForm({ ...form, username: e.target.value })}
					/>
					<input
						className="bg-zinc-800 p-2 w-full rounded"
						type="password"
						placeholder="Password"
						onChange={(e) => setForm({ ...form, password: e.target.value })}
					/>
					<button onClick={handleConnect} className="bg-green-600 px-4 py-2 rounded">
						Connetti
					</button>
				</div>
			) : (
				<Terminal onInput={sendCommand} onReady={() => setOutput('')} />
			)}
		</div>
	)
}