export type WeatherLocation = {
  name: string;
  country: string;
  region?: string;
  latitude: number;
  longitude: number;
};

export type DailyForecast = {
  date: string;
  weatherCode: number;
  high: number;
  low: number;
  precipitationChance: number;
  sunrise: string;
  sunset: string;
};

export type HourlyForecast = {
  time: string;
  temperature: number;
  weatherCode: number;
  precipitationChance: number;
  precipitationAmount: number;
  snowfallAmount: number;
  cloudCover: number;
  isDay: boolean;
};

export type Weather = {
  location: WeatherLocation;
  currentTime: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  uvIndex: number;
  visibility: number;
  weatherCode: number;
  isDay: boolean;
  sunrise: string;
  sunset: string;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
};
