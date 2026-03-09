import React from 'react'
import { FilePicker } from '@/components/file-picker'
import { useGlobalPicker, type GlobalPickerOptions } from '@/providers/global-picker'

type GlobalFilePickerProps = {
	windowId: string
	requestId?: string
	pickerOptions?: GlobalPickerOptions
}

export const GlobalFilePickerApp: React.FC<GlobalFilePickerProps> = ({ requestId, pickerOptions }) => {
	const { submitPicker, cancelPicker } = useGlobalPicker()

	if (!requestId || !pickerOptions) {
		return <div className="h-full w-full bg-[#1e1e1e] text-white p-4">Picker request non valida</div>
	}

	return (
		<div className="h-full w-full pt-2 overflow-hidden border border-white/10 flex flex-col text-white">
			<div className="flex-1 min-h-0 p-2">
				<FilePicker
					onSelected={(file, path) => {
						submitPicker(requestId, { file, path })
					}}
					selectParams={{
						allow: pickerOptions.allow,
						action: pickerOptions.action,
						allowRename: pickerOptions.allowRename,
						fileExtensions: pickerOptions.fileExtensions,
					}}
				/>
			</div>
			<div className="px-3 py-2 border-t border-white/10 bg-black/20 flex justify-end">
				<button
					onClick={() => cancelPicker(requestId)}
					className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20"
				>
					Annulla
				</button>
			</div>
		</div>
	)
}
