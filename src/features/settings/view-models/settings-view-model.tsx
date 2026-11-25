import Storage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';

import type {
  AppearanceMode,
  PersistedWeatherSettings,
  TemperatureUnit,
  TimeFormat,
  WindUnit,
} from '@/features/settings/models/weather-settings';

const SETTINGS_STORAGE_KEY = 'my-weather-settings-v1';

type WeatherSettingsValue = {
  temperatureUnit: TemperatureUnit;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
  windUnit: WindUnit;
  setWindUnit: (unit: WindUnit) => void;
  timeFormat: TimeFormat;
  setTimeFormat: (format: TimeFormat) => void;
  appearance: AppearanceMode;
  setAppearance: (mode: AppearanceMode) => void;
  showFeelsLike: boolean;
  setShowFeelsLike: (show: boolean) => void;
  isNightTheme: boolean;
  setIsNightTheme: (isNight: boolean) => void;
};

const WeatherSettingsContext = createContext<WeatherSettingsValue | null>(null);

export function SettingsViewModelProvider({ children }: PropsWithChildren) {
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>('celsius');
  const [windUnit, setWindUnit] = useState<WindUnit>('kmh');
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('12h');
  const [appearance, setAppearance] = useState<AppearanceMode>('auto');
  const [showFeelsLike, setShowFeelsLike] = useState(true);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [isNightTheme, setIsNightTheme] = useState(() => {
    const hour = new Date().getHours();
    return hour < 6 || hour >= 18;
  });

  useEffect(() => {
    let mounted = true;
    Storage.getItem(SETTINGS_STORAGE_KEY)
      .then((storedSettings) => {
        if (!mounted || !storedSettings) return;
        const settings = JSON.parse(storedSettings) as Partial<PersistedWeatherSettings>;
        if (settings.temperatureUnit === 'celsius' || settings.temperatureUnit === 'fahrenheit') {
          setTemperatureUnit(settings.temperatureUnit);
        }
        if (settings.windUnit === 'kmh' || settings.windUnit === 'mph') setWindUnit(settings.windUnit);
        if (settings.timeFormat === '12h' || settings.timeFormat === '24h') setTimeFormat(settings.timeFormat);
        if (settings.appearance === 'auto' || settings.appearance === 'day' || settings.appearance === 'night') {
          setAppearance(settings.appearance);
        }
        if (typeof settings.showFeelsLike === 'boolean') setShowFeelsLike(settings.showFeelsLike);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setSettingsHydrated(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!settingsHydrated) return;
    const settings: PersistedWeatherSettings = {
      temperatureUnit,
      windUnit,
      timeFormat,
      appearance,
      showFeelsLike,
    };
    void Storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [
    appearance,
    settingsHydrated,
    showFeelsLike,
    temperatureUnit,
    timeFormat,
    windUnit,
  ]);

  return (
    <WeatherSettingsContext.Provider
      value={{
        temperatureUnit,
        setTemperatureUnit,
        windUnit,
        setWindUnit,
        timeFormat,
        setTimeFormat,
        appearance,
        setAppearance,
        showFeelsLike,
        setShowFeelsLike,
        isNightTheme,
        setIsNightTheme,
      }}>
      {children}
    </WeatherSettingsContext.Provider>
  );
}

export function useSettingsViewModel() {
  const value = useContext(WeatherSettingsContext);
  if (!value) throw new Error('useSettingsViewModel must be used inside SettingsViewModelProvider.');
  return value;
}
