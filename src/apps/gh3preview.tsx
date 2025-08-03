import { useWindowManager } from "@/providers/window-manager";
import React from "react";
import { pdfjs } from 'react-pdf'
import { pxToPercent } from '@/utils/viewport'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type Gh3PreviewProps = {
    fileContent: string;
    fileExtension: "txt" | "md" | "log" | "png" | "jpg" | "jpeg" | "gif" | "pdf" | "mp4" | "webp";
    windowId: string;
};

export const Gh3Preview: React.FC<Gh3PreviewProps> = ({ fileContent, fileExtension, windowId }) => {
    const { resizeWindow, moveWindow } = useWindowManager()
    
    switch (fileExtension) {
        case "txt":
        case "log":
        case "md":
            return (
                <div className="h-full overflow-auto custom-scroll max-w-screen font-mono whitespace-pre-wrap p-2.5">
                  {fileContent}
                </div>
            );
        
        case "png":
        case "jpg":
        case "jpeg":
        case "webp":
        case "gif":
            return (
                <div className="w-full flex justify-center max-w-screen">
                    <img
                        src={`${fileContent}`}
                        className=" custom-scroll max-w-screen w-full max-h-screen h-auto font-mono whitespace-pre-wrap p-2.5 rounded-3xl"
                        onLoad={(e) => { resizeWindow(windowId, { width: pxToPercent(e.currentTarget.offsetWidth, 'x'), height: pxToPercent(e.currentTarget.offsetHeight + 44, 'y') }, true); moveWindow(windowId, {x: 50 - pxToPercent(e.currentTarget.offsetWidth, 'x') / 2, y:50 - (pxToPercent(e.currentTarget.offsetHeight + 44, 'y')) / 2}) }}   
                    />
                </div>
            );
        case "mp4":
            return (
                <div className="h-full flex justify-center max-h-screen">
                    <video
                        controls
                        className="custom-scroll max-w-screen h-full max-h-screen w-auto font-mono whitespace-pre-wrap p-2.5"
                        onLoadedData={(e) => { resizeWindow(windowId, { width: pxToPercent(e.currentTarget.videoWidth, 'x'), height: pxToPercent(e.currentTarget.videoHeight + 44, 'y') }, true); moveWindow(windowId, {x: 50 - pxToPercent(e.currentTarget.videoWidth, 'x') / 2, y:50 - (pxToPercent(e.currentTarget.videoHeight + 44, 'y')) / 2}) }}   
                        autoPlay
                        >
                        <source src={`${fileContent}`} className="max-w-screen h-full max-h-screen w-auto"/>
                    </video>
                </div>
            );
        
        case "pdf": {
            return (
                <iframe
                    src={fileContent}
                    title="PDF Viewer"
                    className="max-w-screen w-full max-h-screen h-full border-none custom-scroll font-mono whitespace-pre-wrap p-2.5"
                />
            );
        }
            
        default:
            return <div>Nessuna preview disponibile per questo tipo di file.</div>;
    }

};
