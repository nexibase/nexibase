'use client';

import { useEffect, useState } from 'react';
import { Cloud, CloudRain, Sun, Wind, Droplets, CloudSnow, CloudDrizzle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface WeatherWidgetProps {
  settings?: {
    city?: string;
    apiKey?: string;
  };
}

interface WeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  description: string;
  main: string;
}

export default function WeatherWidget({ settings }: WeatherWidgetProps) {
  const city = settings?.city || 'Seoul';
  const apiKey = settings?.apiKey || process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
  const t = useTranslations('weather-widget');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isCelsius, setIsCelsius] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      if (!apiKey) {
        setError(true);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`
        );

        if (!response.ok) throw new Error('Weather fetch failed');

        const data = await response.json();
        setWeather({
          temp: Math.round(data.main.temp),
          feelsLike: Math.round(data.main.feels_like),
          humidity: data.main.humidity,
          windSpeed: Math.round(data.wind.speed * 3.6), // m/s to km/h
          description: data.weather[0].description,
          main: data.weather[0].main,
        });
        setError(false);
      } catch (err) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 600000); // 10 min
    return () => clearInterval(interval);
  }, [city, apiKey]);

  const getWeatherIcon = (main: string) => {
    const iconClass = 'w-12 h-12';
    switch (main.toLowerCase()) {
      case 'clear':
        return <Sun className={`${iconClass} text-yellow-400`} />;
      case 'clouds':
        return <Cloud className={`${iconClass} text-gray-400`} />;
      case 'rain':
        return <CloudRain className={`${iconClass} text-blue-400`} />;
      case 'drizzle':
        return <CloudDrizzle className={`${iconClass} text-blue-300`} />;
      case 'snow':
        return <CloudSnow className={`${iconClass} text-blue-200`} />;
      default:
        return <Cloud className={`${iconClass} text-gray-400`} />;
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-primary/10 to-primary/25 rounded-lg p-6 text-foreground shadow-lg">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-foreground/20 rounded-full mb-4"></div>
          <div className="h-4 bg-foreground/20 rounded w-32 mb-2"></div>
          <div className="h-8 bg-foreground/20 rounded w-24"></div>
        </div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="bg-gradient-to-br from-gray-400 to-gray-600 rounded-lg p-6 text-white shadow-lg">
        <div className="flex flex-col items-center">
          <Cloud className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-sm text-center">{t('error')}</p>
          <p className="text-xs mt-2 opacity-75">Check API key configuration</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-primary/10 to-primary/25 rounded-lg p-6 text-foreground shadow-lg hover:shadow-xl transition-shadow">
      <div className="flex flex-col items-center">
        <div className="mb-4">
          {getWeatherIcon(weather.main)}
        </div>

        <h3 className="text-2xl font-bold mb-1">{city}</h3>
        <p className="text-sm text-muted-foreground capitalize mb-4">{weather.description}</p>

        <button
          onClick={() => setIsCelsius(!isCelsius)}
          className="text-xs bg-background/60 px-2 py-1 rounded mb-2 hover:bg-background/80 transition-colors"
        >
          {isCelsius ? '°C' : '°F'}
        </button>

        <div className="text-5xl font-bold mb-6">
          {isCelsius ? weather.temp : Math.round(weather.temp * 9 / 5 + 32)}
          {isCelsius ? '°C' : '°F'}
        </div>

        <div className="grid grid-cols-2 gap-4 w-full text-sm">
          <div className="flex items-center justify-center space-x-2 bg-background/60 rounded-lg p-2">
            <Sun className="w-4 h-4" />
            <div>
              <div className="text-muted-foreground text-xs">{t('feelsLike')}</div>
              <div className="font-semibold">
                {isCelsius ? weather.feelsLike : Math.round(weather.feelsLike * 9 / 5 + 32)}
                {isCelsius ? '°C' : '°F'}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-2 bg-background/60 rounded-lg p-2">
            <Droplets className="w-4 h-4" />
            <div>
              <div className="text-muted-foreground text-xs">{t('humidity')}</div>
              <div className="font-semibold">{weather.humidity}%</div>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-2 bg-background/60 rounded-lg p-2 col-span-2">
            <Wind className="w-4 h-4" />
            <div>
              <div className="text-muted-foreground text-xs">{t('wind')}</div>
              <div className="font-semibold">{weather.windSpeed} km/h</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
