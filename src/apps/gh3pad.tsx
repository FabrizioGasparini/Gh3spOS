import { useState } from 'react'
type Props = { fileContent?: string };

export const Gh3Pad = (props?: Props) => {
	const [text, setText] = useState(props?.fileContent || '')

	/* useEffect(() => {
		const saved = localStorage.getItem('gh3pad-content')
		if (saved) setText(saved)
	}, []) */

	/* useEffect(() => {
		localStorage.setItem('gh3pad-content', text)
	}, [text]) */

	return (
		<div className="w-full h-full p-3 text-white custom-scroll">
			<textarea
				value={text}
				onChange={e => setText(e.target.value)}
				className="w-full h-full bg-transparent text-white outline-none resize-none placeholder:text-white/50"
				placeholder="Scrivi qualcosa..."
			/>
		</div>
	)
}
