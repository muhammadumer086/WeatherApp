import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Keyboard, LayoutAnimation } from 'react-native';

import type { Weather, WeatherLocation } from '@/features/weather/models/weather';
import {
  getWeather,
  searchCities,
  searchCity,
} from '@/features/weather/services/weather-service';
import { useSettingsViewModel } from '@/features/settings/view-models/settings-view-model';

const DEFAULT_LOCATION: WeatherLocation = {
  name: 'Islamabad',
  country: 'Pakistan',
  latitude: 33.6844,
  longitude: 73.0479,
};

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Location request timed out.')), milliseconds);
    }),
  ]);
}

function readableRequestError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = error.message.toLocaleLowerCase();
    if (message.includes('network') || message.includes('internet') || message.includes('fetch')) {
      return 'No internet connection. Check your connection and try again.';
    }
    return error.message;
  }
  return fallback;
}

export function useWeatherViewModel() {
  const {
    temperatureUnit,
    windUnit,
    timeFormat,
    appearance,
    showFeelsLike,
    setIsNightTheme,
  } = useSettingsViewModel();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<WeatherLocation[]>([]);
  const [recentCities, setRecentCities] = useState<WeatherLocation[]>([DEFAULT_LOCATION]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [forecastTab, setForecastTab] = useState<'hourly' | 'weekly'>('hourly');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [forecastAnimation] = useState(() => new Animated.Value(1));
  const [weather, setWeather] = useState<Weather | null>(null);
  const [activeLocation, setActiveLocation] = useState(DEFAULT_LOCATION);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [sceneActive, setSceneActive] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setSceneActive(true);
      return () => setSceneActive(false);
    }, []),
  );

  useEffect(() => {
    const city = query.trim();
    if (city.length < 1) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        setSuggestions(await searchCities(city, controller.signal));
      } catch (caughtError) {
        if (!(caughtError instanceof Error && caughtError.name === 'AbortError')) {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      }
    }, city.length === 1 ? 80 : 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const loadWeather = useCallback(async (location: WeatherLocation, refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError(null);
    try {
      const latestWeather = await getWeather(location);
      setWeather(latestWeather);
      setLastUpdatedAt(new Date());
      setActiveLocation(location);
    } catch (caughtError) {
      setError(readableRequestError(caughtError, 'Weather could not be updated right now.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadInitialLocation() {
      try {
        const permission = await withTimeout(Location.requestForegroundPermissionsAsync(), 3000);
        if (permission.status !== 'granted') {
          if (active) await loadWeather(DEFAULT_LOCATION);
          return;
        }

        const position = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          8000,
        );
        const places = await Location.reverseGeocodeAsync(position.coords);
        const place = places[0];
        const deviceLocation: WeatherLocation = {
          name: place?.city ?? place?.district ?? place?.region ?? 'Current location',
          country: place?.country ?? '',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        if (active) await loadWeather(deviceLocation);
      } catch {
        if (active) await loadWeather(DEFAULT_LOCATION);
      }
    }

    void loadInitialLocation();
    return () => {
      active = false;
    };
  }, [loadWeather]);

  function rememberCity(location: WeatherLocation) {
    setRecentCities((cities) => [
      location,
      ...cities.filter(
        (city) => city.latitude !== location.latitude || city.longitude !== location.longitude,
      ),
    ].slice(0, 5));
  }

  async function handleSearch() {
    const city = query.trim();
    if (!city || searching) return;

    Keyboard.dismiss();
    setSearching(true);
    setError(null);
    try {
      const result = suggestions[0] ?? (await searchCity(city));
      rememberCity(result);
      setQuery('');
      setSuggestions([]);
      setSearchFocused(false);
      await loadWeather(result);
    } catch (caughtError) {
      setError(readableRequestError(caughtError, 'City search could not be completed right now.'));
    } finally {
      setSearching(false);
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < 1) {
      setSuggestions([]);
      setSuggestionsLoading(false);
    }
  }

  async function selectSuggestion(location: WeatherLocation) {
    Keyboard.dismiss();
    rememberCity(location);
    setQuery('');
    setSuggestions([]);
    setSearchFocused(false);
    setSearching(true);
    await loadWeather(location);
    setSearching(false);
  }

  const displayTemperature = (celsius: number) =>
    Math.round(temperatureUnit === 'fahrenheit' ? (celsius * 9) / 5 + 32 : celsius);
  const temperatureSymbol = temperatureUnit === 'fahrenheit' ? '°F' : '°C';
  const displayWind = (kilometersPerHour: number) =>
    Math.round(windUnit === 'mph' ? kilometersPerHour * 0.621371 : kilometersPerHour);
  const windSymbol = windUnit === 'mph' ? 'mph' : 'km/h';
  const isNightTheme =
    appearance === 'night' || (appearance === 'auto' && Boolean(weather && !weather.isDay));

  useEffect(() => {
    setIsNightTheme(isNightTheme);
  }, [isNightTheme, setIsNightTheme]);

  const firstCurrentHourIndex = weather
    ? weather.hourly.findIndex(
        (hour) => hour.time.slice(0, 13) >= weather.currentTime.slice(0, 13),
      )
    : -1;
  const next24Hours = weather
    ? weather.hourly.slice(
        Math.max(0, firstCurrentHourIndex),
        Math.max(0, firstCurrentHourIndex) + 24,
      )
    : [];

  function selectForecastTab(tab: 'hourly' | 'weekly') {
    if (tab === forecastTab) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    forecastAnimation.stopAnimation();
    forecastAnimation.setValue(0);
    setForecastTab(tab);
    if (tab === 'hourly') setSelectedDay(null);
    Animated.timing(forecastAnimation, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function toggleDayDetails(date: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedDay((selected) => (selected === date ? null : date));
  }

  return {
    activeLocation,
    displayTemperature,
    displayWind,
    error,
    forecastAnimation,
    forecastTab,
    handleQueryChange,
    handleSearch,
    isNightTheme,
    lastUpdatedAt,
    loading,
    loadWeather,
    next24Hours,
    query,
    recentCities,
    refreshing,
    searching,
    searchFocused,
    sceneActive,
    selectedDay,
    selectForecastTab,
    selectSuggestion,
    setSearchFocused,
    showFeelsLike,
    suggestions,
    suggestionsLoading,
    temperatureSymbol,
    timeFormat,
    toggleDayDetails,
    weather,
    windSymbol,
  };
}
