import type { Weather, WeatherLocation } from '@/features/weather/models/weather';

type GeocodingResponse = {
  results?: {
    name: string;
    country?: string;
    admin1?: string;
    latitude: number;
    longitude: number;
  }[];
};

type PhotonResponse = {
  features?: {
    geometry?: { coordinates?: [number, number] };
    properties?: {
      name?: string;
      locality?: string;
      district?: string;
      city?: string;
      county?: string;
      state?: string;
      country?: string;
    };
  }[];
};

type ForecastResponse = {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    uv_index: number;
    visibility: number;
    weather_code: number;
    is_day: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    sunrise: string[];
    sunset: string[];
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability: number[];
    precipitation: number[];
    snowfall: number[];
    cloud_cover: number[];
    is_day: number[];
  };
};

const FORECAST_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'wind_speed_10m',
  'wind_direction_10m',
  'uv_index',
  'visibility',
  'weather_code',
  'is_day',
].join(',');

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_probability_max',
  'sunrise',
  'sunset',
].join(',');

const HOURLY_FIELDS = [
  'temperature_2m',
  'weather_code',
  'precipitation_probability',
  'precipitation',
  'snowfall',
  'cloud_cover',
  'is_day',
].join(',');

function skyCodeFromCloudCover(cloudCover: number) {
  if (cloudCover < 20) return 0;
  if (cloudCover < 75) return 2;
  return 3;
}

function reconcileHourlyWeatherCode(
  weatherCode: number,
  precipitationChance: number,
  precipitationAmount: number,
  snowfallAmount: number,
  cloudCover: number,
) {
  const isFog = weatherCode >= 45 && weatherCode <= 48;
  if (weatherCode <= 3 || isFog) return weatherCode;

  const isPrecipitationCode = weatherCode >= 51;
  if (!isPrecipitationCode) return weatherCode;

  // weather_code can come from a deterministic model while probability comes
  // from an ensemble. Suppress a precipitation icon when neither source gives
  // meaningful support, otherwise the app can show rain beside a 0% chance.
  const hasMeaningfulPrecipitation =
    precipitationChance >= 15 || precipitationAmount >= 0.5 || snowfallAmount >= 0.2;

  return hasMeaningfulPrecipitation ? weatherCode : skyCodeFromCloudCover(cloudCover);
}

const POPULAR_CITIES: WeatherLocation[] = [
  { name: 'Amsterdam', country: 'Netherlands', latitude: 52.37, longitude: 4.9 },
  { name: 'Berlin', country: 'Germany', latitude: 52.52, longitude: 13.41 },
  { name: 'Cairo', country: 'Egypt', latitude: 30.04, longitude: 31.24 },
  { name: 'Dubai', country: 'United Arab Emirates', latitude: 25.2, longitude: 55.27 },
  { name: 'Edinburgh', country: 'United Kingdom', latitude: 55.95, longitude: -3.19 },
  { name: 'Faisalabad', country: 'Pakistan', latitude: 31.42, longitude: 73.09 },
  { name: 'Guangzhou', country: 'China', latitude: 23.13, longitude: 113.26 },
  { name: 'Hong Kong', country: 'China', latitude: 22.32, longitude: 114.17 },
  { name: 'Islamabad', country: 'Pakistan', latitude: 33.68, longitude: 73.05 },
  { name: 'Jakarta', country: 'Indonesia', latitude: -6.21, longitude: 106.85 },
  { name: 'Karachi', country: 'Pakistan', latitude: 24.86, longitude: 67.01 },
  { name: 'London', country: 'United Kingdom', latitude: 51.51, longitude: -0.13 },
  { name: 'Madrid', country: 'Spain', latitude: 40.42, longitude: -3.7 },
  { name: 'New York', country: 'United States', latitude: 40.71, longitude: -74.01 },
  { name: 'Oslo', country: 'Norway', latitude: 59.91, longitude: 10.75 },
  { name: 'Paris', country: 'France', latitude: 48.86, longitude: 2.35 },
  { name: 'Quito', country: 'Ecuador', latitude: -0.18, longitude: -78.47 },
  { name: 'Rome', country: 'Italy', latitude: 41.9, longitude: 12.5 },
  { name: 'Sydney', country: 'Australia', latitude: -33.87, longitude: 151.21 },
  { name: 'Tokyo', country: 'Japan', latitude: 35.68, longitude: 139.69 },
  { name: 'Vienna', country: 'Austria', latitude: 48.21, longitude: 16.37 },
  { name: 'Warsaw', country: 'Poland', latitude: 52.23, longitude: 21.01 },
  { name: 'Zurich', country: 'Switzerland', latitude: 47.38, longitude: 8.54 },
];

function uniqueLocations(locations: WeatherLocation[]) {
  const seen = new Set<string>();
  return locations.filter((location) => {
    const key = `${location.name}-${location.region ?? ''}-${location.country}`.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchOpenMeteoLocations(query: string, signal?: AbortSignal) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query.trim());
  url.searchParams.set('count', '5');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new Error('No internet connection. Check your connection and try again.');
  }
  if (!response.ok) throw new Error('City search is unavailable right now.');

  const data = (await response.json()) as GeocodingResponse;
  return (data.results ?? []).map((result) => ({
    name: result.name,
    country: result.country ?? '',
    region: result.admin1,
    latitude: result.latitude,
    longitude: result.longitude,
  }));
}

async function searchPhotonLocations(query: string, signal?: AbortSignal) {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query.trim());
  url.searchParams.set('limit', '8');
  url.searchParams.set('lang', 'en');

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new Error('No internet connection. Check your connection and try again.');
  }
  if (!response.ok) throw new Error('Place search is unavailable right now.');

  const data = (await response.json()) as PhotonResponse;
  return (data.features ?? []).flatMap((feature): WeatherLocation[] => {
    const properties = feature.properties;
    const coordinates = feature.geometry?.coordinates;
    if (!properties?.name || !coordinates || coordinates.length < 2) return [];

    const [longitude, latitude] = coordinates;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

    const regionParts = [
      properties.locality,
      properties.district,
      properties.city,
      properties.county,
      properties.state,
    ].filter((part, index, parts): part is string => Boolean(part) && parts.indexOf(part) === index);

    return [{
      name: properties.name,
      country: properties.country ?? '',
      region: regionParts.slice(0, 2).join(', ') || undefined,
      latitude,
      longitude,
    }];
  });
}

export async function searchCities(query: string, signal?: AbortSignal): Promise<WeatherLocation[]> {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery.length === 1) {
    return POPULAR_CITIES.filter((city) =>
      city.name.toLocaleLowerCase().startsWith(normalizedQuery),
    ).slice(0, 5);
  }

  try {
    const photonLocations = await searchPhotonLocations(query, signal);
    if (photonLocations.length > 0) return uniqueLocations(photonLocations).slice(0, 5);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
  }

  return uniqueLocations(await searchOpenMeteoLocations(query, signal)).slice(0, 5);
}

export async function searchCity(query: string): Promise<WeatherLocation> {
  const result = (await searchCities(query))[0];
  if (!result) throw new Error(`We could not find “${query.trim()}”. Try another city.`);

  return result;
}

export async function getWeather(location: WeatherLocation): Promise<Weather> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('current', FORECAST_FIELDS);
  url.searchParams.set('hourly', HOURLY_FIELDS);
  url.searchParams.set('daily', DAILY_FIELDS);
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('models', 'best_match');

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch {
    throw new Error('No internet connection. Check your connection and try again.');
  }
  if (!response.ok) throw new Error('Weather data is unavailable right now.');

  const data = (await response.json()) as ForecastResponse;
  const sunrise = data.daily.sunrise[0];
  const sunset = data.daily.sunset[0];
  const isDay = sunrise && sunset
    ? data.current.time >= sunrise && data.current.time < sunset
    : data.current.is_day === 1;
  return {
    location,
    currentTime: data.current.time,
    temperature: data.current.temperature_2m,
    apparentTemperature: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    windDirection: data.current.wind_direction_10m,
    uvIndex: data.current.uv_index,
    visibility: data.current.visibility,
    weatherCode: data.current.weather_code,
    isDay,
    sunrise,
    sunset,
    hourly: data.hourly.time.map((time, index) => {
      const precipitationChance = data.hourly.precipitation_probability[index] ?? 0;
      const precipitationAmount = data.hourly.precipitation[index] ?? 0;
      const snowfallAmount = data.hourly.snowfall[index] ?? 0;
      const cloudCover = data.hourly.cloud_cover[index] ?? 0;

      return {
        time,
        temperature: data.hourly.temperature_2m[index],
        weatherCode: reconcileHourlyWeatherCode(
          data.hourly.weather_code[index],
          precipitationChance,
          precipitationAmount,
          snowfallAmount,
          cloudCover,
        ),
        precipitationChance,
        precipitationAmount,
        snowfallAmount,
        cloudCover,
        isDay: data.hourly.is_day[index] === 1,
      };
    }),
    daily: data.daily.time.map((date, index) => ({
      date,
      weatherCode: data.daily.weather_code[index],
      high: data.daily.temperature_2m_max[index],
      low: data.daily.temperature_2m_min[index],
      precipitationChance: data.daily.precipitation_probability_max[index] ?? 0,
      sunrise: data.daily.sunrise[index],
      sunset: data.daily.sunset[index],
    })),
  };
}

export function weatherDescription(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  return 'Thunderstorm';
}

export function weatherIcon(code: number, isDay = true): string {
  if (code === 0) return isDay ? '☀️' : '🌙';
  if (code <= 2) return isDay ? '🌤️' : '🌙';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌦️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}
