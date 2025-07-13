import {motion, useMotionValue} from 'framer-motion'
import React from 'react'
import {useLocation} from 'react-router-dom'

import {DockItem} from './DockItem'


const DOCK_BOTTOM_PADDING_PX = 10

const DOCK_DIMENSIONS_PX = {
	preview: {
		iconSize: 50,
		iconSizeZoomed: 80,
		padding: 12,
	},
	desktop: {
		iconSize: 50,
		iconSizeZoomed: 80,
		padding: 12,
	},
	mobile: {
		iconSize: 48,
		iconSizeZoomed: 60,
		padding: 8,
	},
} as const

type DockDimensionsPx = {
	iconSize: number
	iconSizeZoomed: number
	padding: number
	dockHeight: number
}

function useDockDimensions(options?: {isPreview?: boolean}): DockDimensionsPx {

	if (options?.isPreview) {
		const {iconSize, iconSizeZoomed, padding} = DOCK_DIMENSIONS_PX.preview
		return {iconSize, iconSizeZoomed, padding, dockHeight: iconSize + padding * 2}
	}

	const dimensions = DOCK_DIMENSIONS_PX.desktop
	const {iconSize, iconSizeZoomed, padding} = dimensions
	return {iconSize, iconSizeZoomed, padding, dockHeight: iconSize + padding * 2}
}

export function Dock() {
    const { pathname } = useLocation()
    const mouseX = useMotionValue(Infinity)
	const {iconSize, iconSizeZoomed, padding, dockHeight} = useDockDimensions()

	// TODO: THIS IS A HACK
	// We need a better approach to track the last visited path (possibly scroll position too?)
	// inside every page. We do this right now for the File app because it's has the most
	// UX-advantage (eg. user accidentally clicking close while they're in a deeply nested path)

	return (
		<>
			<motion.div
				initial={{y: 0, opacity: 0}}
				animate={{y: 0, opacity: 1}}
				onPointerMove={(e: PointerEvent) => e.pointerType === 'mouse' && mouseX.set(e.pageX)}
				onPointerLeave={() => mouseX.set(Infinity)}
				className={dockClass}
				style={{
					height: dockHeight,
					paddingBottom: padding,
				}}
			>
				<DockItem
					iconSize={iconSize}
					iconSizeZoomed={iconSizeZoomed}
					open={pathname === '/'}
					mouseX={mouseX}
				/>
				<DockItem
					iconSize={iconSize}
					iconSizeZoomed={iconSizeZoomed}
					mouseX={mouseX}
				/>
				<DockItem
					iconSize={iconSize}
					iconSizeZoomed={iconSizeZoomed}
					// TODO: This is hack, we should use the systemAppTo but currently systemAppTo is /files/Home
					// so this fails the check when the path is /files/Recents, /files/Trash, etc.
					// We need a proper redirect to /files/Home when the user navigates to /files
					open={pathname.startsWith('/files')}
					mouseX={mouseX}
				/>
				<DockItem
					iconSize={iconSize}
					iconSizeZoomed={iconSizeZoomed}
					mouseX={mouseX}
				/>
				<DockItem
					iconSize={iconSize}
					iconSizeZoomed={iconSizeZoomed}
					mouseX={mouseX}
				/>
				<DockItem
					iconSize={iconSize}
					iconSizeZoomed={iconSizeZoomed}
					mouseX={mouseX}
				/>
			</motion.div>
		</>
	)
}

export function DockPreview() {
	const mouseX = useMotionValue(Infinity)
	const {iconSize, iconSizeZoomed, padding, dockHeight} = useDockDimensions({isPreview: true})

	return (
		<div
			className={dockPreviewClass}
			style={{
				height: dockHeight,
				paddingBottom: padding,
			}}
		>
			<DockItem
				mouseX={mouseX}
				iconSize={iconSize}
				iconSizeZoomed={iconSizeZoomed}
			/>
			<DockItem
				mouseX={mouseX}
				iconSize={iconSize}
				iconSizeZoomed={iconSizeZoomed}
			/>
			<DockItem
				mouseX={mouseX}
				iconSize={iconSize}
				iconSizeZoomed={iconSizeZoomed}
			/>
			<DockItem
				mouseX={mouseX}
				iconSize={iconSize}
				iconSizeZoomed={iconSizeZoomed}
			/>
			<DockDivider iconSize={iconSize} />
			<DockItem
				mouseX={mouseX}
				iconSize={iconSize}
				iconSizeZoomed={iconSizeZoomed}
			/>
			<DockItem
				mouseX={mouseX}
				iconSize={iconSize}
				iconSizeZoomed={iconSizeZoomed}
			/>
		</div>
	)
}

export function DockSpacer({className}: {className?: string}) {
	const {dockHeight} = useDockDimensions()
	return <div className={'w-full shrink-0 ' + className} style={{height: dockHeight + DOCK_BOTTOM_PADDING_PX}} />
}

export function DockBottomPositioner({children}: {children: React.ReactNode}) {
	return (
		<div className='fixed bottom-0 left-1/2 z-50 -translate-x-1/2' style={{paddingBottom: DOCK_BOTTOM_PADDING_PX}}>
			{children}
		</div>
	)
}

const dockClass = `mx-auto flex items-end gap-3 rounded-2xl bg-black/10 contrast-more:bg-neutral-700 backdrop-blur-2xl contrast-more:backdrop-blur-none px-3 shadow-dock shrink-0 will-change-transform transform-gpu border-hpx border-white/10`
const dockPreviewClass = `mx-auto flex items-end gap-4 rounded-2xl bg-neutral-900/80 px-3 shadow-dock shrink-0 border-hpx border-white/10`

const DockDivider = ({iconSize}: {iconSize: number}) => (
	<div className='br grid w-1 place-items-center' style={{height: iconSize}}>
		<div className='h-7 border-r border-white/10' />
	</div>
)