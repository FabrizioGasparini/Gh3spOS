import { widgets } from '@/widgets/definitions'
import { WidgetPreviewCard } from '@/components/widget/WidgetPreviewCard'
import { useWidgetManager } from '@/providers/widget-manager'

export const WidgetStore = () => {
  const { addWidget } = useWidgetManager()

  return (
    <div className="flex flex-col items-center justify-center overflow-hidden h-full overflow-y-auto custom-scroll">
        <div className="p-4 w-[95%] h-full max-w-5xl">
        <div className="flex flex-wrap gap-6">
          {[...widgets].filter(([, w]) => w.inStore).map(([id, widget]) => (
            <WidgetPreviewCard
              key={id}
              widget={widget}
              onInstall={() => {
                addWidget(widget, id)
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
