import { useState } from 'react'

export const TodoWidget = () => {
  const [todos, setTodos] = useState<string[]>([])
  const [input, setInput] = useState('')

  const add = () => {
    if (input.trim()) {
      setTodos([...todos, input])
      setInput('')
    }
  }

  const remove = (i: number) => {
    setTodos(todos.filter((_, idx) => idx !== i))
  }

  return (
    <div className="w-full h-full flex flex-col text-white p-3 text-sm">
      <div className="flex mb-2 gap-2">
        <input
          className="flex-1 rounded px-2 py-1 text-black text-xs"
          placeholder="Nuovo task"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button onClick={add} className="bg-white/20 px-2 rounded">+ Aggiungi</button>
      </div>
      <ul className="flex flex-col gap-1">
        {todos.map((todo, i) => (
          <li key={i} className="flex justify-between items-center bg-white/10 rounded px-2 py-1">
            <span>{todo}</span>
            <button onClick={() => remove(i)} className="text-red-400 hover:text-red-300">✕</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
