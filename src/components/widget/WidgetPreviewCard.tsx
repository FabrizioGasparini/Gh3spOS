import { useWallpaper } from '@/providers/wallpaper'
import type { WidgetDefinition } from '@/types'

export const WidgetPreviewCard = ({
  widget,
  onInstall,
}: {
  widget: WidgetDefinition
  onInstall: () => void
}) => {
  const { wallpaper } = useWallpaper()
    

  return (
    <div className="bg-black/15 backdrop-blur-lg border border-black/10 rounded-xl p-4 shadow hover:scale-[1.02] transition-all flex-1 min-w-2xs flex flex-col gap-3">
        
        <div
        className="relative w-full aspect-square rounded-lg overflow-hidden  shadow-lg"
        style={{
          backgroundImage: `url(${wallpaper})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div
          className="absolute inset-0 p-3 flex items-center justify-center"
        >
          <div className="rounded-xl border border-white/20 shadow-xl backdrop-blur-md bg-white/10 overflow-hidden relative p-3 overflow-y-auto pointer-events-none"
            style={{
              width: widget.defaultSize!.width > widget.defaultSize!.height ? "100%" : `${widget.defaultSize!.width * 100 / widget.defaultSize!.height}%`,
              height: widget.defaultSize!.height > widget.defaultSize!.width ? "100%" : `${widget.defaultSize!.height * 100 / widget.defaultSize!.width}%`
            }}
          >
            <widget.component/>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-white font-semibold">{widget.name}</h3>
        <p className="text-white/70 text-sm">{widget.storeDescription}</p>
      </div>

      <button
        onClick={onInstall}
        className="mt-auto py-1.5 px-4 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-sm"
      >
        Installa
      </button>
    </div>
  )
}
