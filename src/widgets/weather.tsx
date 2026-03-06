import { useEffect, useState } from "react";

type WeatherState = {
  city: string;
  temperature: number | null;
  wind: number | null;
  humidity: number | null;
  description: string;
};

const weatherCodeToText = (code: number) => {
  if (code === 0) return "Sereno";
  if ([1, 2, 3].includes(code)) return "Parzialmente nuvoloso";
  if ([45, 48].includes(code)) return "Nebbia";
  if ([51, 53, 55, 56, 57].includes(code)) return "Pioviggine";
  if ([61, 63, 65, 66, 67].includes(code)) return "Pioggia";
  if ([71, 73, 75, 77].includes(code)) return "Neve";
  if ([80, 81, 82].includes(code)) return "Rovesci";
  if ([95, 96, 99].includes(code)) return "Temporale";
  return "Variabile";
};

export const WeatherWidget = () => {
  const [weather, setWeather] = useState<WeatherState>({
    city: "Rilevamento...",
    temperature: null,
    wind: null,
    humidity: null,
    description: "In attesa dati",
  });

  useEffect(() => {
    const loadWeather = async (lat: number, lon: number) => {
      try {
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`);
        const geoRes = await fetch(`https://geocode.maps.co/reverse?lat=${lat}&lon=${lon}`);

        const weatherData = await weatherRes.json();
        const geoData = await geoRes.json();

        const current = weatherData?.current;
        const cityName = geoData?.address?.city || geoData?.address?.town || geoData?.address?.village || "Località attuale";

        setWeather({
          city: cityName,
          temperature: current?.temperature_2m ?? null,
          humidity: current?.relative_humidity_2m ?? null,
          wind: current?.wind_speed_10m ?? null,
          description: weatherCodeToText(current?.weather_code ?? -1),
        });
      } catch {
        setWeather({
          city: "Offline",
          temperature: null,
          wind: null,
          humidity: null,
          description: "Dati meteo non disponibili",
        });
      }
    };

    if (!navigator.geolocation) {
      setWeather((prev) => ({ ...prev, city: "Geolocalizzazione non supportata", description: "Posizione non disponibile" }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => loadWeather(pos.coords.latitude, pos.coords.longitude),
      () => setWeather((prev) => ({ ...prev, city: "Posizione negata", description: "Consenti la geolocalizzazione" })),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, []);

  return (
    <div className="w-full h-full flex flex-col justify-between text-white font-sans p-4">
      <div className="text-lg font-semibold">🌤️ {weather.city}</div>
      <div className="text-4xl">{weather.temperature !== null ? `${Math.round(weather.temperature)}°C` : "--"}</div>
      <div className="text-sm opacity-70">{weather.description}</div>
      <div className="text-xs opacity-60">💧 {weather.humidity !== null ? `${weather.humidity}%` : "--"} · 🌬 {weather.wind !== null ? `${Math.round(weather.wind)} km/h` : "--"}</div>
    </div>
  )
}