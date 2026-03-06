import { useMemo, useState } from 'react'
import { usePersistentStore } from '@/providers/persistent-store'

type TodoItem = {
  id: string
  text: string
  done: boolean
}

export const TodoWidget = () => {
  const [todos, setTodos] = usePersistentStore<TodoItem[]>('widget:todo:v2', [])
  const [input, setInput] = useState('')

  const completed = useMemo(() => todos.filter(todo => todo.done).length, [todos])

  const add = () => {
    if (input.trim()) {
      setTodos(prev => [...prev, { id: crypto.randomUUID(), text: input.trim(), done: false }])
      setInput('')
    }
  }

  const remove = (id: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== id))
  }

  const toggle = (id: string) => {
    setTodos(prev => prev.map(todo => (todo.id === id ? { ...todo, done: !todo.done } : todo)))
  }

  const clearDone = () => {
    setTodos(prev => prev.filter(todo => !todo.done))
  }

  return (
    <div className="w-full h-full flex flex-col text-white p-3 text-sm">
      <div className="flex items-center justify-between mb-2 text-xs opacity-75">
        <span>Completati: {completed}/{todos.length}</span>
        {completed > 0 && <button onClick={clearDone} className="hover:text-red-300">Pulisci fatti</button>}
      </div>

      <div className="flex mb-2 gap-2">
        <input
          className="flex-1 rounded px-2 py-1 text-black text-xs"
          placeholder="Nuovo task"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') add()
          }}
        />
        <button onClick={add} className="bg-white/20 px-2 rounded">+ Aggiungi</button>
      </div>
      <ul className="flex flex-col gap-1 overflow-auto custom-scroll">
        {todos.map((todo) => (
          <li key={todo.id} className="flex justify-between items-center bg-white/10 rounded px-2 py-1 gap-2">
            <label className="flex items-center gap-2 flex-1 min-w-0">
              <input type="checkbox" checked={todo.done} onChange={() => toggle(todo.id)} />
              <span className={`truncate ${todo.done ? 'line-through opacity-60' : ''}`}>{todo.text}</span>
            </label>
            <button onClick={() => remove(todo.id)} className="text-red-400 hover:text-red-300">✕</button>
          </li>
        ))}
        {todos.length === 0 && <li className="text-xs opacity-60">Nessun task. Aggiungine uno!</li>}
      </ul>
    </div>
  )
}
