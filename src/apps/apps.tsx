import { Settings } from "@/routes/settings"
import type { AppDefinition } from "@/types"

import { Gh3Pad } from "@/apps/gh3pad"
import { Gh3Preview } from "@/apps/gh3preview"
import { FileExplorer } from "@/apps/file-explorer"

export const apps: Map<string, AppDefinition> = new Map<string, AppDefinition>([
	['settings', {
		name: 'Impostazioni',
		icon: 'dock-settings.png',
		component: Settings,
		isPinned: true, 
	}],
	['notes', {
		name: 'Note',
		icon: 'default-icon.svg',
		component: () => <h1>Notes</h1>,
		isPinned: false,
		defaultSize: {width: 30, height: 40}
	}],
	['gh3pad', {
		name: 'Gh3Pad',
		icon: 'gh3-pad.png',
		component: Gh3Pad,
		isPinned: true
	}],
	['gh3preview', {
		name: 'Gh3Preview',
		icon: 'dock-preview.png',
		component: Gh3Preview,
		isPinned: false
	}],
	['file-explorer', {
		name: 'File Explorer',
		icon: 'dock-files.png',
		component: FileExplorer,
		isPinned: true
	}]
])

