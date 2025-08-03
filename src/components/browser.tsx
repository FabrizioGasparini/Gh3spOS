const Browser = () => {
    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 bg-gray-800 text-white">
                <h1 className="text-lg font-semibold">Browser</h1>
                <button className="bg-blue-600 px-3 py-1 rounded hover:bg-blue-700">
                    Refresh
                </button>
            </div>
            <div className="flex-1 p-4 overflow-auto">
                <webview 
                    src="https://www.google.com"
                    className="w-full h-full"
                    style={{ border: 'none' }}
                />
                <p className="mt-4 text-gray-400">This is a simple browser component.</p>
            </div>
            <div className="p-4 bg-gray-800 text-white">
                <p className="text-sm">Browser footer content</p>
            </div>
        </div>
    );
}

export default Browser;