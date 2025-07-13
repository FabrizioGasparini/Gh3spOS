import {HTMLMotionProps, motion, MotionValue, SpringOptions, useSpring, useTransform, Variants} from 'framer-motion'
import {useEffect, useRef, useState} from 'react'
import {type LinkProps} from 'react-router-dom'

type HTMLDivProps = HTMLMotionProps<'div'>
type DockItemProps = {
	notificationCount?: number
	bg?: string
	open?: boolean
	mouseX: MotionValue<number>
	to?: LinkProps['to']
	iconSize: number
	iconSizeZoomed: number
	className?: string
	style?: React.CSSProperties
	onClick?: (e: React.MouseEvent) => void
} & HTMLDivProps

const BOUNCE_DURATION = 0.4

export function DockItem({
	bg,
	mouseX,
	open,
	style,
	onClick,
	iconSize,
	iconSizeZoomed,
	...props
}: DockItemProps) {
	const [clickedOpen, setClickedOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) setClickedOpen(false)
	}, [open])

	const distance = useTransform(mouseX, (val: number) => {
		const bounds = ref.current?.getBoundingClientRect() ?? {x: 0, width: 0}

		return val - bounds.x - bounds.width / 2
	})

	const springOptions: SpringOptions = {
		mass: 0.1,
		stiffness: 150,
		damping: 10,
	}

	const widthSync = useTransform(distance, [-150, 0, 150], [iconSize, iconSizeZoomed, iconSize])
	const width = useSpring(widthSync, springOptions)

	const scaleSync = useTransform(distance, [-150, 0, 150], [1, iconSizeZoomed / iconSize, 1])
	const transform = useSpring(scaleSync, springOptions)

	const variants: Variants = {
		open: {
			transition: {
				default: {
					duration: 0.2,
				},
				translateY: {
					duration: BOUNCE_DURATION,
					ease: 'easeInOut',
					times: [0, 0.5, 1],
				},
			},
			translateY: [0, -20, 0],
		},
		closed: {},
	}
	const variant = open && clickedOpen ? 'open' : 'closed'

	return (
		<motion.div ref={ref} className='relative aspect-square' style={{width}}>
			{/* icon glow */}
			<div
				className='absolute hidden h-full w-full bg-cover opacity-30 md:block'
				style={{
					backgroundImage: `url(${bg})`,
					filter: 'blur(16px)',
					transform: 'translateY(4px)',
				}}
			/>
			{/* icon */}
			<motion.div
				className='relative origin-top-left bg-cover transition-[filter] has-[:focus-visible]:brightness-125'
				
				style={{
					width: iconSize,
					height: iconSize,
					backgroundImage: bg
						? `url(${bg})`
						: // TODO: use a better default
							`linear-gradient(to bottom right, white, black)`,
					scale: transform,
					...style,
				}}
				onClick={(e: Event) => {
					setClickedOpen(true)
					onClick?.(e)
				}}
				{...props}
				variants={variants}
				animate={variant}
			>
	
			</motion.div>
			{open && <OpenPill />}
		</motion.div>
	)
}

function OpenPill() {
	return (
		<motion.div
			className='absolute -bottom-[7px] left-1/2 h-[2px] w-[10px] -translate-x-1/2 rounded-full bg-white'
			initial={{
				opacity: 0,
			}}
			animate={{
				opacity: 1,
				transition: {
					delay: BOUNCE_DURATION,
				},
			}}
		/>
	)
}