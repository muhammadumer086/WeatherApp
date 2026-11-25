export type TemperatureUnit = 'celsius' | 'fahrenheit';
export type WindUnit = 'kmh' | 'mph';
export type AppearanceMode = 'auto' | 'day' | 'night';
export type TimeFormat = '12h' | '24h';

export type PersistedWeatherSettings = {
  temperatureUnit: TemperatureUnit;
  windUnit: WindUnit;
  timeFormat: TimeFormat;
  appearance: AppearanceMode;
  showFeelsLike: boolean;
};
