import { useEffect, useMemo, useState } from 'react'
import { useWidgetManager } from '@/providers/widget-manager'
import { widgets } from '@/widgets/definitions'
import { useWallpaper } from '@/providers/wallpaper'
import type { WidgetSettingValue } from '@/types'

export const WidgetStore = () => {
  const { addWidget, widgets: installedWidgets, updateWidgetStyle, updateWidgetSettings } = useWidgetManager()
  const { wallpaper } = useWallpaper()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isShiftPressed, setIsShiftPressed] = useState(false)
  const [previewSettings, setPreviewSettings] = useState<Record<string, WidgetSettingValue>>({})
  const [previewAppearance, setPreviewAppearance] = useState<{
    opacity: number
    blur: number
    border: number
    padding: number
    scaleMode: 'auto' | 'manual'
    scale: number
  }>({
    opacity: 78,
    blur: 12,
    border: 18,
    padding: 8,
    scaleMode: 'auto',
    scale: 100,
  })

  const catalog = useMemo(() => ([...widgets.entries()]
    .filter(([, widget]) => widget.inStore)
    .map(([id, widget]) => ({ id, widget }))), [])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return catalog
    return catalog.filter(({ id, widget }) =>
      id.toLowerCase().includes(term) ||
      widget.name.toLowerCase().includes(term) ||
      (widget.storeDescription || '').toLowerCase().includes(term),
    )
  }, [catalog, query])

  const featured = filtered.slice(0, 3)
  const selected = useMemo(() => {
    if (!selectedId) return null
    return catalog.find((item) => item.id === selectedId) ?? null
  }, [catalog, selectedId])

  useEffect(() => {
    if (!selectedId) return
    if (!selected) setSelectedId(null)
  }, [selectedId, selected])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') setIsShiftPressed(true)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') setIsShiftPressed(false)
    }
    const onWindowBlur = () => setIsShiftPressed(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setPreviewAppearance({
      opacity: 78,
      blur: 12,
      border: 18,
      padding: 8,
      scaleMode: 'auto',
      scale: 100,
    })
    if (selectedId === 'clock') {
      setPreviewSettings({ clock24h: true, clockShowSeconds: false })
      return
    }
    if (selectedId === 'weather') {
      setPreviewSettings({ weatherUnit: 'c', weatherWindUnit: 'kmh' })
      return
    }
    if (selectedId === 'network') {
      setPreviewSettings({ networkIntervalSec: 5 })
      return
    }
    setPreviewSettings({})
  }, [selectedId])

  const getInstallCount = (widgetId: string) => installedWidgets.filter((w) => w.widgetId === widgetId).length

  if (selectedId && selected) {
    const PREVIEW_SCALE_MAX = 170
    const installCount = getInstallCount(selected.id)
    const previewBaseWidth = Math.max(180, (selected.widget.defaultSize?.width ?? 2) * 120)
    const previewBaseHeight = Math.max(120, (selected.widget.defaultSize?.height ?? 2) * 95)
    const previewPanelWidth = 380
    const previewPanelHeight = 230
    const autoScale = Math.max(0.45, Math.min(1.7, Math.min(previewPanelWidth / previewBaseWidth, previewPanelHeight / previewBaseHeight)))
    const manualScale = Math.max(0.4, Math.min(PREVIEW_SCALE_MAX / 100, previewAppearance.scale / 100))
    const contentScale = previewAppearance.scaleMode === 'manual' ? manualScale : autoScale
    const previewFrameScale = previewAppearance.scaleMode === 'manual'
      ? Math.max(0.7, Math.min(1.12, previewAppearance.scale / 100))
      : 1
    const previewWidgetWidth = Math.round((previewBaseWidth * contentScale) + (previewAppearance.padding * 2))
    const previewWidgetHeight = Math.round((previewBaseHeight * contentScale) + (previewAppearance.padding * 2))
    const rawFrameWidth = previewWidgetWidth * previewFrameScale
    const rawFrameHeight = previewWidgetHeight * previewFrameScale
    const previewSafeMaxWidth = 760
    const previewSafeMaxHeight = 520
    const previewSafetyScale = Math.min(
      1,
      previewSafeMaxWidth / Math.max(1, rawFrameWidth),
      previewSafeMaxHeight / Math.max(1, rawFrameHeight),
    )
    const effectiveFrameScale = previewFrameScale * previewSafetyScale
    const heroTextBottomOffset = Math.max(-8, Math.min(16, Math.round((effectiveFrameScale - 1) * 28)))
    const hasSpecificSettings = selected.id === 'clock' || selected.id === 'weather' || selected.id === 'network'
    const clock24h = previewSettings.clock24h !== false
    const clockShowSeconds = previewSettings.clockShowSeconds === true
    const weatherUnit = previewSettings.weatherUnit === 'f' ? 'f' : 'c'
    const weatherWindUnit = previewSettings.weatherWindUnit === 'mph' ? 'mph' : 'kmh'
    const networkIntervalSec = typeof previewSettings.networkIntervalSec === 'number' ? Math.max(2, Math.min(30, Math.round(previewSettings.networkIntervalSec))) : 5
    const addWithPreviewSettings = () => {
      const widgetId = addWidget(selected.widget, selected.id)
      updateWidgetStyle(widgetId, {
        opacity: previewAppearance.opacity,
        blur: previewAppearance.blur,
        border: previewAppearance.border,
      })
      updateWidgetSettings(widgetId, {
        contentScaleMode: previewAppearance.scaleMode,
        contentScale: Math.min(PREVIEW_SCALE_MAX, previewAppearance.scale),
        padding: previewAppearance.padding,
        widgetSpecific: previewSettings,
      })
    }
    const defaultInstallLabel = installCount > 0 ? 'Aggiungi widget' : 'Ottieni widget'
    const previewInstallLabel = installCount > 0 ? 'Aggiungi con impostazioni preview' : 'Ottieni con impostazioni preview'

    return (
      <div className="h-full w-full p-5 text-white overflow-auto custom-scroll ">
        <div className="sticky top-0 z-30 mb-4 flex items-center justify-between gap-2 pb-2">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setSelectedId(null)
            }}
            className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20 hover:bg-white/15 text-sm"
          >
            ← Torna allo Store
          </button>
        </div>

        <div className="rounded-3xl border border-white/20 bg-white/6 overflow-hidden">
          <div className="relative min-h-[300px]">
            <img src={wallpaper} alt="Widget background" className="absolute inset-0 w-full h-full object-cover opacity-85" />
            <div className="absolute inset-0 " />
            <div className="relative p-6 flex flex-col justify-end gap-5 min-h-[300px]">
              <div className="max-w-3xl transition-transform duration-200" style={{ transform: `translateY(${heroTextBottomOffset}px)` }}>
                <p className="text-xs uppercase tracking-widest text-white/65">Widget</p>
                <h2 className="text-4xl font-semibold leading-tight">{selected.widget.name}</h2>
                <p className="text-white/80 mt-2 max-w-3xl">{selected.widget.storeDescription || 'Widget desktop dinamico per il tuo workspace.'}</p>
              </div>

              <div className="hidden md:flex w-full items-center justify-center pointer-events-none">
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    width: `${previewWidgetWidth}px`,
                    height: `${previewWidgetHeight}px`,
                    border: `1px solid rgba(255,255,255,${0.35 * (previewAppearance.border / 100)})`,
                    backgroundColor: `rgba(255,255,255,${(previewAppearance.opacity / 100) * 0.18})`,
                    backdropFilter: `blur(${previewAppearance.blur}px)`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,${0.1 * (previewAppearance.border / 100)}), 0 18px 45px rgba(0,0,0,${0.22 * (previewAppearance.opacity / 100)})`,
                    transform: `scale(${effectiveFrameScale})`,
                    transformOrigin: 'center bottom',
                    transition: 'transform 160ms ease',
                  }}
                >
                  <div className="w-full h-full overflow-hidden" style={{ padding: `${previewAppearance.padding}px` }}>
                    <div
                      style={{
                        transform: `scale(${contentScale})`,
                        transformOrigin: 'top left',
                        width: `${100 / contentScale}%`,
                        height: `${100 / contentScale}%`,
                      }}
                    >
                      <selected.widget.component
                        widgetInstanceId={`store-preview-${selected.id}`}
                        widgetSettings={previewSettings}
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className={`p-6 grid grid-cols-1 ${hasSpecificSettings ? 'xl:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]' : ''} gap-4`}>
            {hasSpecificSettings && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/15 bg-black/25 p-4">
                  <h3 className="text-lg font-semibold">Impostazioni widget</h3>
                  <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-3 space-y-2">
                    {selected.id === 'clock' && (
                      <>
                        <label className="flex items-center justify-between text-[11px] text-white/80">
                          <span>Formato 24h</span>
                          <input
                            type="checkbox"
                            checked={clock24h}
                            onChange={(event) => setPreviewSettings((prev) => ({ ...prev, clock24h: event.target.checked }))}
                          />
                        </label>
                        <label className="flex items-center justify-between text-[11px] text-white/80">
                          <span>Mostra secondi</span>
                          <input
                            type="checkbox"
                            checked={clockShowSeconds}
                            onChange={(event) => setPreviewSettings((prev) => ({ ...prev, clockShowSeconds: event.target.checked }))}
                          />
                        </label>
                      </>
                    )}

                    {selected.id === 'weather' && (
                      <>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewSettings((prev) => ({ ...prev, weatherUnit: 'c' }))}
                            className={`px-2 h-6 rounded-md border text-[11px] ${weatherUnit === 'c' ? 'border-cyan-300/50 bg-cyan-400/20' : 'border-white/15 bg-white/10 hover:bg-white/20'}`}
                          >
                            °C
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewSettings((prev) => ({ ...prev, weatherUnit: 'f' }))}
                            className={`px-2 h-6 rounded-md border text-[11px] ${weatherUnit === 'f' ? 'border-cyan-300/50 bg-cyan-400/20' : 'border-white/15 bg-white/10 hover:bg-white/20'}`}
                          >
                            °F
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewSettings((prev) => ({ ...prev, weatherWindUnit: 'kmh' }))}
                            className={`px-2 h-6 rounded-md border text-[11px] ${weatherWindUnit === 'kmh' ? 'border-cyan-300/50 bg-cyan-400/20' : 'border-white/15 bg-white/10 hover:bg-white/20'}`}
                          >
                            km/h
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewSettings((prev) => ({ ...prev, weatherWindUnit: 'mph' }))}
                            className={`px-2 h-6 rounded-md border text-[11px] ${weatherWindUnit === 'mph' ? 'border-cyan-300/50 bg-cyan-400/20' : 'border-white/15 bg-white/10 hover:bg-white/20'}`}
                          >
                            mph
                          </button>
                        </div>
                      </>
                    )}

                    {selected.id === 'network' && (
                      <div>
                        <p className="text-[11px] text-white/65 mb-1">Intervallo ping ({networkIntervalSec}s)</p>
                        <input
                          type="range"
                          min={2}
                          max={30}
                          value={networkIntervalSec}
                          onChange={(event) => setPreviewSettings((prev) => ({ ...prev, networkIntervalSec: Number(event.target.value) }))}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-white/15 bg-black/25 p-4 h-fit">
              <h3 className="text-lg font-semibold">Installa & Personalizza</h3>
              <div className="mt-3 space-y-3">
                <button
                  onClick={(event) => {
                    const usePreviewSettings = event.shiftKey || isShiftPressed
                    if (usePreviewSettings) {
                      addWithPreviewSettings()
                      return
                    }
                    addWidget(selected.widget, selected.id)
                  }}
                  className={`relative w-full px-3 py-4 rounded-xl text-lg font-medium transition-all duration-200 ${isShiftPressed ? 'bg-emerald-500/90 hover:bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.25),0_10px_25px_rgba(16,185,129,0.2)] scale-[1.01]' : 'bg-blue-500/85 hover:bg-blue-500 shadow-[0_8px_20px_rgba(59,130,246,0.18)] scale-100'}`}
                  title="Tieni premuto Shift per applicare le impostazioni correnti della preview"
                >
                  <span className={`inline-flex items-center gap-1.5 transition-transform duration-200 ${isShiftPressed ? 'translate-y-[-0.5px]' : ''}`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full transition-all duration-200 ${isShiftPressed ? 'bg-emerald-100 shadow-[0_0_10px_rgba(167,243,208,0.9)]' : 'bg-white/80'}`} />
                    {isShiftPressed ? previewInstallLabel : defaultInstallLabel}
                  </span>
                </button>

                <div className={`text-center pb-1.5 text-[8px] ${isShiftPressed ?  'text-emerald-100' : 'text-white/70'}`}>
                  {isShiftPressed
                    ? 'Il click installerà con le impostazioni della preview.'
                    : 'Tieni premuto Shift per installare direttamente con la preview corrente.'}
                </div>

                <p className="text-xs text-white/70">I widget installati si possono spostare liberamente sul desktop, ridimensionare e personalizzare.</p>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-white/85">Stile preview</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-lg border border-white/15 bg-white/5 p-2">
                      <p className="text-[11px] text-white/65 mb-1">Opacità sfondo</p>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={previewAppearance.opacity}
                        onChange={(event) => setPreviewAppearance((prev) => ({ ...prev, opacity: Number(event.target.value) }))}
                        className="w-full"
                      />
                    </div>
                    <div className="rounded-lg border border-white/15 bg-white/5 p-2">
                      <p className="text-[11px] text-white/65 mb-1">Bordo</p>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={previewAppearance.border}
                        onChange={(event) => setPreviewAppearance((prev) => ({ ...prev, border: Number(event.target.value) }))}
                        className="w-full"
                      />
                    </div>
                    <div className="rounded-lg border border-white/15 bg-white/5 p-2">
                      <p className="text-[11px] text-white/65 mb-1">Blur</p>
                      <input
                        type="range"
                        min={0}
                        max={40}
                        value={previewAppearance.blur}
                        onChange={(event) => setPreviewAppearance((prev) => ({ ...prev, blur: Number(event.target.value) }))}
                        className="w-full"
                      />
                    </div>
                    <div className="rounded-lg border border-white/15 bg-white/5 p-2">
                      <p className="text-[11px] text-white/65 mb-1">Padding</p>
                      <input
                        type="range"
                        min={0}
                        max={24}
                        value={previewAppearance.padding}
                        onChange={(event) => setPreviewAppearance((prev) => ({ ...prev, padding: Number(event.target.value) }))}
                        className="w-full"
                      />
                    </div>
                    <div className="rounded-lg border border-white/15 bg-white/5 p-2 sm:col-span-2">
                      <p className="text-[11px] text-white/65 mb-1">Scala contenuto</p>
                      <div className="flex gap-1 mb-1">
                        <button
                          type="button"
                          onClick={() => setPreviewAppearance((prev) => ({ ...prev, scaleMode: 'auto' }))}
                          className={`px-2 h-6 rounded-md border text-[11px] ${previewAppearance.scaleMode === 'auto' ? 'border-cyan-300/50 bg-cyan-400/20' : 'border-white/15 bg-white/10 hover:bg-white/20'}`}
                        >
                          Auto
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewAppearance((prev) => ({ ...prev, scaleMode: 'manual' }))}
                          className={`px-2 h-6 rounded-md border text-[11px] ${previewAppearance.scaleMode === 'manual' ? 'border-cyan-300/50 bg-cyan-400/20' : 'border-white/15 bg-white/10 hover:bg-white/20'}`}
                        >
                          Manuale
                        </button>
                      </div>
                      <input
                        type="range"
                        min={40}
                        max={PREVIEW_SCALE_MAX}
                        value={previewAppearance.scale}
                        disabled={previewAppearance.scaleMode !== 'manual'}
                        onChange={(event) => setPreviewAppearance((prev) => ({ ...prev, scale: Number(event.target.value) }))}
                        className="w-full disabled:opacity-40"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full p-5 text-white overflow-auto custom-scroll ">
      <div className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl p-5 mb-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Today</p>
        <h2 className="text-3xl font-semibold leading-tight mt-1">Widget Store</h2>
        <p className="text-sm text-white/70 mt-2">Widget cool, liberi sul desktop, con stile glass personalizzabile.</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca widget..."
            className="px-4 py-2.5 rounded-full bg-white/10 border border-white/20 outline-none text-sm w-full md:w-[360px]"
          />
          <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-white/70">
            {filtered.length} widget
          </span>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">In evidenza</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {featured.map(({ id, widget }) => (
            <button
              key={`featured-${id}`}
              onClick={() => setSelectedId(id)}
              className="relative overflow-hidden rounded-2xl border border-white/15 bg-black/20 min-h-[180px] text-left hover:border-white/35 transition"
            >
              <img src={wallpaper} alt={widget.name} className="absolute inset-0 w-full h-full object-cover opacity-80" />
              <div className="absolute inset-0 " />
              <div className="relative p-4 flex flex-col h-full justify-end">
                <p className="text-[10px] uppercase tracking-widest text-white/70">Widget</p>
                <p className="text-xl font-semibold">{widget.name}</p>
                <p className="text-xs text-white/75 line-clamp-2">{widget.storeDescription || 'Widget desktop personalizzabile'}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Tutti i widget</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(({ id, widget }) => {
            const installCount = getInstallCount(id)
            return (
              <div key={id} className="rounded-2xl border border-white/20 bg-white/10 overflow-hidden">
                <div className="p-4 flex items-start gap-3">
                  <div className="h-14 w-14 rounded-2xl border border-white/15 bg-black/30 flex items-center justify-center text-lg font-semibold">W</div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <button className="min-w-0 text-left" onClick={() => setSelectedId(id)}>
                        <p className="font-semibold truncate">{widget.name}</p>
                        <p className="text-xs text-white/65 truncate">{id} · Widget</p>
                      </button>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/25 bg-white/10 whitespace-nowrap">
                        {installCount > 0 ? `${installCount} installato` : 'Nuovo'}
                      </span>
                    </div>

                    <button onClick={() => setSelectedId(id)} className="text-left w-full">
                      <p className="text-sm text-white/80 mt-2">{widget.storeDescription || 'Widget desktop personalizzabile con stile moderno.'}</p>
                    </button>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => addWidget(widget, id)}
                        className="px-3 py-1.5 rounded-lg bg-blue-500/85 hover:bg-blue-500 text-xs font-medium"
                      >
                        {installCount > 0 ? 'Aggiungi' : 'Ottieni'}
                      </button>
                      <button
                        onClick={() => setSelectedId(id)}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs"
                      >
                        Dettagli
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
