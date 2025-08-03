export const WeatherWidget = () => {
  return (
    <div className="w-full h-full flex flex-col justify-between text-white font-sans p-4">
      <div className="text-lg font-semibold">🌤️ Correggio</div>
      <div className="text-4xl">26°C</div>
      <div className="text-sm opacity-60">Soleggiato · 40% umidità</div>
    </div>
  )
}