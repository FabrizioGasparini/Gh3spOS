import Terminal from '@/components/terminal/index'
import { useSSH } from '@/hooks/useSSH'
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

type SSHLink = {
  id: string
  name: string
  host: string
  port: number
  username: string
  password: string
}

function isJson(str: string) {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

export const SSHConnect = () => {
  const [links, setLinks] = useState<SSHLink[]>([])
  const [activeTab, setActiveTab] = useState<number>(0)
  const terminalRefs = useRef<any[]>([])

  const { connect, sendCommand } = useSSH(
    (output) => terminalRefs.current[activeTab]?.write(isJson(output) ? JSON.parse(output).data : output),
    (status) => terminalRefs.current[activeTab]?.writeln(`\r\n${status}\r\n`)
  )

  // Carica collegamenti salvati
  useEffect(() => {
    const stored = localStorage.getItem('sshLinks')
    if (stored) setLinks(JSON.parse(stored))
  }, [])

  useEffect(() => {
    localStorage.setItem('sshLinks', JSON.stringify(links))
  }, [links])

  const addLink = () => {
    const newLink: SSHLink = {
      id: crypto.randomUUID(),
      name: `New SSH #${links.length + 1}`,
      host: '',
      port: 22,
      username: '',
      password: '',
    }
    setLinks([...links, newLink])
    setActiveTab(links.length)
  }

  const updateLink = (index: number, updated: Partial<SSHLink>) => {
    setLinks(prev =>
      prev.map((link, i) => (i === index ? { ...link, ...updated } : link))
    )
  }

  const deleteLink = (index: number) => {
    setLinks(prev => prev.filter((_, i) => i !== index))
    if (activeTab === index) setActiveTab(0)
  }

  const handleReady = (term: any, index: number) => {
    terminalRefs.current[index] = term
    const link = links[index]
    if (link.host && link.username) {
      connect({
        host: link.host,
        port: link.port,
        username: link.username,
        password: link.password,
      })
    }
    term.onData((data: string) => sendCommand(data))
  }

  return (
    <div className="flex flex-col h-full bg-black/30 rounded-xl backdrop-blur-md border border-white/20 overflow-hidden">
      {/* Header Tabs */}
      <div className="flex items-center bg-white/10 text-white text-sm px-2 py-1 gap-2 overflow-x-auto">
        {links.map((link, i) => (
          <div
            key={link.id}
            onClick={() => setActiveTab(i)}
            className={clsx(
              'px-3 py-1 rounded-md cursor-pointer transition',
              activeTab === i
                ? 'bg-white/30 shadow text-white'
                : 'bg-white/10 hover:bg-white/20 text-white/70'
            )}
          >
            {link.name}
          </div>
        ))}
        <button
          onClick={addLink}
          className="ml-auto px-3 py-1 bg-blue-500 hover:bg-blue-600 rounded-md text-white"
        >
          ＋ Nuovo
        </button>
      </div>

      {/* Editor info connessione */}
      {links[activeTab] && (
        <div className="p-4 text-sm text-white space-y-2 bg-white/5 border-b border-white/10">
          <div className="flex gap-4 flex-wrap">
            <input
              value={links[activeTab].name}
              onChange={(e) => updateLink(activeTab, { name: e.target.value })}
              className="bg-black/20 px-3 py-1 rounded-md text-white w-48"
              placeholder="Nome"
            />
            <input
              value={links[activeTab].host}
              onChange={(e) => updateLink(activeTab, { host: e.target.value })}
              className="bg-black/20 px-3 py-1 rounded-md text-white w-48"
              placeholder="Host"
            />
            <input
              type="number"
              value={links[activeTab].port}
              onChange={(e) => updateLink(activeTab, { port: +e.target.value })}
              className="bg-black/20 px-3 py-1 rounded-md text-white w-20"
              placeholder="Porta"
            />
            <input
              value={links[activeTab].username}
              onChange={(e) => updateLink(activeTab, { username: e.target.value })}
              className="bg-black/20 px-3 py-1 rounded-md text-white w-40"
              placeholder="Username"
            />
            <input
              type="password"
              value={links[activeTab].password}
              onChange={(e) => updateLink(activeTab, { password: e.target.value })}
              className="bg-black/20 px-3 py-1 rounded-md text-white w-40"
              placeholder="Password"
            />
            <button
              onClick={() => deleteLink(activeTab)}
              className="text-red-400 hover:text-red-500 ml-auto"
            >
              Elimina
            </button>
          </div>
        </div>
      )}

      {/* Terminale */}
      <div className="flex-1">
        {links[activeTab] && (
          <Terminal onReady={(term) => handleReady(term, activeTab)} />
        )}
      </div>
    </div>
  )
}
