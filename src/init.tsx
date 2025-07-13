import React from 'react'
import { createRoot } from 'react-dom/client'

export function init(app: React.ReactNode) {
	const root = document.getElementById('root')!
	createRoot(root).render(app)
}
