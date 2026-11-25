import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { HourlyForecast } from '@/features/weather/models/weather';
import { weatherDescription } from '@/features/weather/services/weather-service';
import { useWeatherViewModel } from '@/features/weather/view-models/use-weather-view-model';
import { WeatherScene, weatherPalette } from '@/features/weather/views/components/weather-scene';

function formatForecastDay(date: string, index: number) {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

function formatHour(
  time: string,
  index: number,
  timeFormat: '12h' | '24h',
  includeMinutes = false,
) {
  if (index === 0) return 'Now';
  const timePart = time.split('T')[1] ?? '00:00';
  const [hourText, minute = '00'] = timePart.split(':');
  const hour = Number(hourText);
  if (timeFormat === '24h') return includeMinutes ? `${hourText}:${minute}` : hourText;

  const period = hour >= 12 ? 'PM' : 'AM';
  const twelveHour = hour % 12 || 12;
  return includeMinutes ? `${twelveHour}:${minute} ${period}` : `${twelveHour} ${period}`;
}

function formatUpdatedTime(time: Date, timeFormat: '12h' | '24h') {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: timeFormat === '12h',
  }).format(time);
}

function formatHourlyPrecipitation(hour: HourlyForecast) {
  if (hour.precipitationChance < 15) {
    if (hour.snowfallAmount >= 0.2) return `${hour.snowfallAmount.toFixed(1)} cm`;
    if (hour.precipitationAmount >= 0.5) return `${hour.precipitationAmount.toFixed(1)} mm`;
  }
  return `${hour.precipitationChance}%`;
}

function windDirectionLabel(degrees: number) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round((((degrees % 360) + 360) % 360) / 45) % directions.length];
}

function weatherCodeGroup(code: number) {
  if (code === 0) return 0;
  if (code <= 2) return 2;
  if (code === 3) return 3;
  if (code <= 48) return 45;
  if (code <= 57) return 51;
  if (code <= 67) return 61;
  if (code <= 77) return 71;
  if (code <= 82) return 80;
  if (code <= 86) return 85;
  return 95;
}

function representativeDayWeatherCode(dailyCode: number, hours: HourlyForecast[]) {
  // Open-Meteo's daily code can be driven by a short overnight event. For a row
  // labelled as a day, show the condition that occurs most during daylight hours.
  const daytimeHours = hours.filter((hour) => hour.isDay);
  const representativeHours = daytimeHours.length > 0 ? daytimeHours : hours;
  if (representativeHours.length === 0) return weatherCodeGroup(dailyCode);

  const counts = new Map<number, number>();
  representativeHours.forEach((hour) => {
    const group = weatherCodeGroup(hour.weatherCode);
    counts.set(group, (counts.get(group) ?? 0) + 1);
  });

  let representativeCode = weatherCodeGroup(dailyCode);
  let highestCount = -1;
  counts.forEach((count, code) => {
    if (count > highestCount) {
      representativeCode = code;
      highestCount = count;
    }
  });

  return representativeCode;
}

function representativeDayPrecipitationChance(
  fallbackChance: number,
  hours: HourlyForecast[],
) {
  if (hours.length === 0) return fallbackChance;
  return Math.max(...hours.map((hour) => hour.precipitationChance));
}

function WeatherGlyph({ code, isDay, size }: { code: number; isDay: boolean; size: number }) {
  const isClear = code === 0;
  const isPartlyCloudy = code === 1 || code === 2;
  const isOvercast = code === 3;

  if (isClear || isPartlyCloudy || isOvercast) {
    return (
      <View style={[styles.weatherGlyph, { width: size * 1.2, height: size }]}>
        {!isOvercast ? (
          <Text
            style={[
              styles.celestialGlyph,
              {
                fontSize: size,
                lineHeight: size,
                color: isDay ? '#FFD65A' : '#DDEBFF',
              },
              isDay ? styles.sunGlyph : styles.moonGlyph,
            ]}>
            {isDay ? '☀︎' : '☾'}
          </Text>
        ) : null}
        {isPartlyCloudy || isOvercast ? (
          <Image
            source={require('@/assets/images/weather-cloud.png')}
            contentFit="contain"
            style={[
              styles.cloudGlyph,
              {
                width: size * (isOvercast ? 0.95 : 0.78),
                height: size * (isOvercast ? 0.58 : 0.48),
                right: isOvercast ? size * 0.12 : 0,
              },
            ]}
          />
        ) : null}
      </View>
    );
  }

  const isFog = code <= 48;
  const isDrizzle = code >= 51 && code <= 57;
  const isRain = (code >= 61 && code <= 67) || (code >= 80 && code <= 82);
  const isSnow = (code >= 71 && code <= 77) || (code >= 85 && code <= 86);
  const isThunderstorm = code >= 95;
  const rainStreakCount = code >= 80 && code <= 82 ? 4 : 3;

  return (
    <View style={[styles.weatherGlyph, { width: size * 1.2, height: size }]}>
      <Image
        source={require('@/assets/images/weather-cloud.png')}
        contentFit="contain"
        style={[
          styles.conditionCloud,
          { width: size * 0.94, height: size * 0.56 },
        ]}
      />

      {isFog ? (
        <View style={[styles.fogLines, { width: size * 0.72, height: size * 0.3 }]}>
          {[0.72, 1, 0.78].map((width, index) => (
            <View
              key={index}
              style={[
                styles.fogLine,
                { width: `${width * 100}%`, height: Math.max(2, size * 0.055) },
              ]}
            />
          ))}
        </View>
      ) : null}

      {isDrizzle || isRain ? (
        <View style={[styles.precipitationRow, { width: size * 0.64, height: size * 0.32 }]}>
          {Array.from({ length: rainStreakCount }, (_, index) => (
            <View
              key={index}
              style={[
                styles.rainStreak,
                {
                  width: Math.max(2, size * 0.065),
                  height: size * (isDrizzle ? 0.15 : 0.24),
                  opacity: isDrizzle ? 0.78 : 1,
                },
              ]}
            />
          ))}
        </View>
      ) : null}

      {isSnow ? (
        <View style={[styles.snowRow, { width: size * 0.72, height: size * 0.34 }]}>
          {Array.from({ length: 3 }, (_, index) => (
            <Text key={index} style={[styles.snowFlake, { fontSize: size * 0.22 }]}>
              ✦
            </Text>
          ))}
        </View>
      ) : null}

      {isThunderstorm ? (
        <Text style={[styles.stormBolt, { fontSize: size * 0.5, lineHeight: size * 0.52 }]}>ϟ</Text>
      ) : null}
    </View>
  );
}

function CompactWeatherIcon({ code, isDay, size }: { code: number; isDay: boolean; size: number }) {
  return (
    <View style={[styles.compactWeatherIcon, { width: size * 1.3, height: size + 6 }]}>
      <WeatherGlyph code={code} isDay={isDay} size={size} />
    </View>
  );
}

function HeroWeatherGlyph({ code, isDay }: { code: number; isDay: boolean }) {
  const isClear = code === 0;
  const isPartlyCloudy = code === 1 || code === 2;
  const isOvercast = code === 3;

  if (!isClear && !isPartlyCloudy && !isOvercast) {
    return <WeatherGlyph code={code} isDay={isDay} size={108} />;
  }

  return (
    <View style={styles.heroWeatherArt}>
      {!isOvercast && isDay ? (
        <View style={styles.heroSun}>
          {Array.from({ length: 8 }, (_, index) => (
            <View
              key={index}
              style={[styles.heroSunRayArm, { transform: [{ rotate: `${index * 45}deg` }] }]}>
              <View style={styles.heroSunRay} />
            </View>
          ))}
          <View style={styles.heroSunCore}>
            <View style={styles.heroSunHighlight} />
          </View>
        </View>
      ) : null}

      {!isOvercast && !isDay ? (
        <View style={styles.heroMoon}>
          <Text style={styles.heroMoonGlyph}>☾</Text>
          <Text style={[styles.heroMoonStar, styles.heroMoonStarLarge]}>✦</Text>
          <Text style={[styles.heroMoonStar, styles.heroMoonStarSmall]}>•</Text>
        </View>
      ) : null}

      {isPartlyCloudy || isOvercast ? (
        <Image
          source={require('@/assets/images/weather-cloud.png')}
          contentFit="contain"
          style={[styles.heroCloud, isOvercast && styles.heroCloudOvercast]}
        />
      ) : null}
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const {
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
  } = useWeatherViewModel();
  const backgroundColor = weatherPalette(weather?.weatherCode ?? 0, isNightTheme).colors[0];

  return (
    <View style={[styles.screen, { backgroundColor }]}>
      <StatusBar style="light" />
      <WeatherScene
        code={weather?.weatherCode ?? 0}
        isNight={isNightTheme}
        active={sceneActive}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadWeather(activeLocation, true)}
            tintColor="#FFFFFF"
            colors={['#FFFFFF']}
          />
        }>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>LIVE WEATHER</Text>
            <Text style={styles.headerTitle}>Current Weather</Text>
            <Text style={styles.lastUpdated}>
              {lastUpdatedAt ? `Last updated ${formatUpdatedTime(lastUpdatedAt, timeFormat)}` : 'Updating weather…'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open weather settings"
              onPress={() => router.push('/settings')}
              style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}>
              <Text style={styles.settingsIcon}>⚙</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            onSubmitEditing={handleSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search city..."
            placeholderTextColor="rgba(255,255,255,0.58)"
            returnKeyType="search"
            autoCapitalize="words"
            autoCorrect={false}
            style={styles.searchInput}
            accessibilityLabel="Search for a city"
          />
          <Pressable
            onPress={handleSearch}
            disabled={!query.trim() || searching}
            style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}>
            {searching ? (
              <ActivityIndicator size="small" color="#155EA8" />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </Pressable>
        </View>

        {searchFocused && query.trim().length === 0 && recentCities.length > 0 ? (
          <View style={styles.suggestionsCard}>
            <Text style={styles.recentHeading}>RECENT CITIES</Text>
            {recentCities.map((city, index) => (
              <Pressable
                key={`${city.latitude}-${city.longitude}`}
                onPressIn={() => void selectSuggestion(city)}
                style={({ pressed }) => [
                  styles.suggestionRow,
                  index === recentCities.length - 1 && styles.lastSuggestionRow,
                  pressed && styles.suggestionPressed,
                ]}>
                <View style={styles.suggestionPin}>
                  <Text style={styles.recentClock}>↻</Text>
                </View>
                <View style={styles.suggestionTextBlock}>
                  <Text style={styles.suggestionName}>{city.name}</Text>
                  <Text style={styles.suggestionPlace} numberOfLines={1}>
                    {[city.region, city.country].filter(Boolean).join(', ')}
                  </Text>
                </View>
                <Text style={styles.suggestionArrow}>›</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {query.trim().length >= 1 && (suggestionsLoading || suggestions.length > 0) ? (
          <View style={styles.suggestionsCard}>
            {suggestionsLoading && suggestions.length === 0 ? (
              <View style={styles.suggestionLoading}>
                <ActivityIndicator size="small" color="#2380D5" />
                <Text style={styles.suggestionLoadingText}>Finding cities…</Text>
              </View>
            ) : (
              suggestions.map((suggestion, index) => (
                <Pressable
                  key={`${suggestion.latitude}-${suggestion.longitude}`}
                  onPress={() => selectSuggestion(suggestion)}
                  style={({ pressed }) => [
                    styles.suggestionRow,
                    index === suggestions.length - 1 && styles.lastSuggestionRow,
                    pressed && styles.suggestionPressed,
                  ]}>
                  <View style={styles.suggestionPin}>
                    <Text style={styles.suggestionPinText}>●</Text>
                  </View>
                  <View style={styles.suggestionTextBlock}>
                    <Text style={styles.suggestionName}>{suggestion.name}</Text>
                    <Text style={styles.suggestionPlace} numberOfLines={1}>
                      {[suggestion.region, suggestion.country].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                  {index === 0 ? <Text style={styles.bestMatch}>BEST MATCH</Text> : null}
                  <Text style={styles.suggestionArrow}>›</Text>
                </Pressable>
              ))
            )}
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => loadWeather(activeLocation)}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {loading && !weather ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color="#FFFFFF" size="large" />
            <Text style={styles.loadingText}>Looking at the sky…</Text>
          </View>
        ) : weather ? (
          <>
            <View style={styles.currentCard}>
              <View style={styles.locationRow}>
                <Text style={styles.pin}>●</Text>
                <Text style={styles.location} numberOfLines={1}>
                  {weather.location.name}
                  {weather.location.country ? `, ${weather.location.country}` : ''}
                </Text>
              </View>

              <View style={styles.currentWeatherRow}>
                <View style={styles.temperatureBlock}>
                  <Text
                    style={styles.temperature}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}>
                    {displayTemperature(weather.temperature)}°
                  </Text>
                  <Text style={styles.condition}>{weatherDescription(weather.weatherCode)}</Text>
                  {showFeelsLike ? (
                    <Text style={styles.feelsLike}>
                      Feels like {displayTemperature(weather.apparentTemperature)}{temperatureSymbol}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.heroIcon}>
                  <HeroWeatherGlyph code={weather.weatherCode} isDay={weather.isDay} />
                </View>
              </View>

              <View style={styles.statsPanel}>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statIcon}>●</Text>
                    <View style={styles.statText}>
                      <Text style={styles.statValue}>{weather.humidity}%</Text>
                      <Text style={styles.statLabel}>Humidity</Text>
                    </View>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statIcon}>≈</Text>
                    <View style={styles.statText}>
                      <Text style={styles.statValue}>
                        {displayWind(weather.windSpeed)} {windSymbol}
                      </Text>
                      <Text style={styles.statLabel}>
                        Wind • {windDirectionLabel(weather.windDirection)}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.statsHorizontalDivider} />
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statIcon}>☀︎</Text>
                    <View style={styles.statText}>
                      <Text style={styles.statValue}>{Math.round(weather.uvIndex * 10) / 10}</Text>
                      <Text style={styles.statLabel}>UV Index</Text>
                    </View>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statIcon}>⌾</Text>
                    <View style={styles.statText}>
                      <Text style={styles.statValue}>{Math.round(weather.visibility / 100) / 10} km</Text>
                      <Text style={styles.statLabel}>Visibility</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.statsHorizontalDivider} />
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statIcon}>↑</Text>
                    <View style={styles.statText}>
                      <Text style={styles.statValue}>{formatHour(weather.sunrise, -1, timeFormat, true)}</Text>
                      <Text style={styles.statLabel}>Sunrise</Text>
                    </View>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statIcon}>↓</Text>
                    <View style={styles.statText}>
                      <Text style={styles.statValue}>{formatHour(weather.sunset, -1, timeFormat, true)}</Text>
                      <Text style={styles.statLabel}>Sunset</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.forecastTabs}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: forecastTab === 'hourly' }}
                onPress={() => selectForecastTab('hourly')}
                style={({ pressed }) => [styles.forecastTab, pressed && styles.forecastTabPressed]}>
                <Text
                  style={[
                    styles.forecastTabText,
                    forecastTab === 'hourly' && styles.forecastTabTextActive,
                  ]}>
                  Hourly Forecast
                </Text>
                {forecastTab === 'hourly' ? <View style={styles.forecastTabIndicator} /> : null}
              </Pressable>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: forecastTab === 'weekly' }}
                onPress={() => selectForecastTab('weekly')}
                style={({ pressed }) => [styles.forecastTab, pressed && styles.forecastTabPressed]}>
                <Text
                  style={[
                    styles.forecastTabText,
                    forecastTab === 'weekly' && styles.forecastTabTextActive,
                  ]}>
                  Weekly Forecast
                </Text>
                {forecastTab === 'weekly' ? <View style={styles.forecastTabIndicator} /> : null}
              </Pressable>
            </View>

            {forecastTab === 'hourly' ? (
              <Animated.View
                style={[
                  styles.forecastAnimatedPanel,
                  {
                    opacity: forecastAnimation,
                    transform: [
                      {
                        translateY: forecastAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [18, 0],
                        }),
                      },
                    ],
                  },
                ]}>
                <View style={styles.hourlyScrollHint}>
                  <Text style={styles.hourlyScrollHintText}>Next 24 hours</Text>
                  <Text style={styles.hourlyScrollHintAction}>Swipe to explore →</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hourlyList}>
                  {next24Hours.map((hour, index) => (
                    <View key={hour.time} style={[styles.hourCard, index === 0 && styles.currentHourCard]}>
                      <Text style={[styles.hourTime, index === 0 && styles.currentHourText]}>
                        {formatHour(hour.time, index, timeFormat)}
                      </Text>
                      <View style={styles.hourIcon}>
                        <CompactWeatherIcon code={hour.weatherCode} isDay={hour.isDay} size={32} />
                      </View>
                      <Text style={styles.hourTemperature}>{displayTemperature(hour.temperature)}°</Text>
                      <View style={styles.hourRainRow}>
                        <Text style={styles.hourDrop}>💧</Text>
                        <Text style={styles.hourRain}>{formatHourlyPrecipitation(hour)}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </Animated.View>
            ) : (
              <Animated.View
                style={[
                  styles.forecastAnimatedPanel,
                  {
                    opacity: forecastAnimation,
                    transform: [
                      {
                        translateY: forecastAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [24, 0],
                        }),
                      },
                      {
                        scale: forecastAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.98, 1],
                        }),
                      },
                    ],
                  },
                ]}>
                <View style={styles.weeklyIntro}>
                  <View style={styles.weeklyIntroContent}>
                    <Text style={styles.weeklyIntroEyebrow}>7-DAY OUTLOOK</Text>
                    <Text style={styles.weeklyIntroTitle}>Plan your week</Text>
                    <Text style={styles.weeklyIntroText}>Tap any day to explore its hourly weather</Text>
                    <Text style={styles.weeklyLegend}>💧 Rain chance   •   High° / Low°</Text>
                  </View>
                  <View style={styles.weeklyIntroIcon}>
                    <Text style={styles.weeklyIntroIconText}>▦</Text>
                  </View>
                </View>

                <View style={styles.forecastCard}>
                {weather.daily.map((day, index) => {
                  const dayIsOpen = selectedDay === day.date;
                  const dayHours = weather.hourly.filter((hour) => hour.time.startsWith(day.date));
                  const relevantDayHours = index === 0
                    ? dayHours.filter(
                        (hour) => hour.time.slice(0, 13) >= weather.currentTime.slice(0, 13),
                      )
                    : dayHours;
                  const displayWeatherCode = representativeDayWeatherCode(
                    day.weatherCode,
                    relevantDayHours,
                  );
                  const displayPrecipitationChance = representativeDayPrecipitationChance(
                    day.precipitationChance,
                    relevantDayHours,
                  );
                  const animationStart = index * 0.045;
                  const animationEnd = animationStart + 0.45;

                  return (
                    <Animated.View
                      key={day.date}
                      style={[
                        styles.forecastDayBlock,
                        index === weather.daily.length - 1 && styles.lastForecastDayBlock,
                        {
                          opacity: forecastAnimation.interpolate({
                            inputRange: [animationStart, animationEnd],
                            outputRange: [0, 1],
                            extrapolate: 'clamp',
                          }),
                          transform: [
                            {
                              translateY: forecastAnimation.interpolate({
                                inputRange: [animationStart, animationEnd],
                                outputRange: [16, 0],
                                extrapolate: 'clamp',
                              }),
                            },
                          ],
                        },
                      ]}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${formatForecastDay(day.date, index)}, ${weatherDescription(displayWeatherCode)}, ${displayPrecipitationChance} percent precipitation chance, high ${displayTemperature(day.high)} degrees, low ${displayTemperature(day.low)} degrees, show hourly weather`}
                        onPress={() => toggleDayDetails(day.date)}
                        style={styles.forecastRow}>
                        <Text style={[styles.day, index === 0 && styles.today]}>
                          {formatForecastDay(day.date, index)}
                        </Text>
                        <View style={styles.forecastIcon}>
                          <CompactWeatherIcon code={displayWeatherCode} isDay size={36} />
                        </View>
                        <View style={styles.rainChance}>
                          <Text style={styles.drop}>💧</Text>
                          <Text style={styles.rainText}>{displayPrecipitationChance}%</Text>
                        </View>
                        <View style={styles.highLowGroup}>
                          <View style={styles.temperaturePair}>
                            <Text style={styles.temperatureLabel}>H</Text>
                            <Text style={styles.high}>{displayTemperature(day.high)}°</Text>
                          </View>
                          <View style={styles.temperaturePair}>
                            <Text style={styles.temperatureLabel}>L</Text>
                            <Text style={styles.low}>{displayTemperature(day.low)}°</Text>
                          </View>
                        </View>
                        <Text style={[styles.dayChevron, dayIsOpen && styles.dayChevronOpen]}>›</Text>
                      </Pressable>

                      {dayIsOpen ? (
                        <View style={styles.dayHourlyDetails}>
                          <Text style={styles.dayHourlyTitle}>
                            Hourly breakdown • conditions can change through the day
                          </Text>
                          <ScrollView
                            horizontal
                            nestedScrollEnabled
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.dayHourlyList}>
                            {relevantDayHours.map((hour) => (
                              <View key={hour.time} style={styles.dayHourCard}>
                                <Text style={styles.dayHourTime}>{formatHour(hour.time, -1, timeFormat)}</Text>
                                <CompactWeatherIcon code={hour.weatherCode} isDay={hour.isDay} size={29} />
                                <Text style={styles.dayHourTemperature}>
                                  {displayTemperature(hour.temperature)}°
                                </Text>
                                <Text style={styles.dayHourRain}>💧 {formatHourlyPrecipitation(hour)}</Text>
                              </View>
                            ))}
                          </ScrollView>
                        </View>
                      ) : null}
                    </Animated.View>
                  );
                })}
                </View>
              </Animated.View>
            )}

            <Text style={styles.attribution}>Weather: Open-Meteo • Places: OpenStreetMap / Photon</Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  eyebrow: { color: 'rgba(255,255,255,0.66)', fontSize: 11, fontWeight: '800', letterSpacing: 2.2 },
  headerTitle: { color: '#FFFFFF', fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8 },
  lastUpdated: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '600',
    marginTop: 1,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingsButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  settingsIcon: { color: '#FFFFFF', fontSize: 17, lineHeight: 20 },
  searchBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingLeft: 16,
    paddingRight: 7,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    marginBottom: 16,
  },
  searchIcon: {
    width: 26,
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 26,
    textAlign: 'center',
    marginRight: 10,
    marginTop: -2,
  },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 16, paddingVertical: 0, minWidth: 60 },
  searchButton: {
    minWidth: 64,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
  },
  searchButtonText: { color: '#155EA8', fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  suggestionsCard: {
    backgroundColor: 'rgba(8,42,73,0.94)',
    borderRadius: 18,
    paddingHorizontal: 8,
    marginTop: -8,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#001A33',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  suggestionLoading: { height: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  suggestionLoadingText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  recentHeading: { color: '#7EDBFF', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 3 },
  suggestionRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.13)',
  },
  lastSuggestionRow: { borderBottomWidth: 0 },
  suggestionPressed: { backgroundColor: 'rgba(126,219,255,0.12)' },
  suggestionPin: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(126,219,255,0.14)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  suggestionPinText: { color: '#7EDBFF', fontSize: 9 },
  recentClock: { color: '#7EDBFF', fontSize: 16, fontWeight: '800' },
  suggestionTextBlock: { flex: 1, minWidth: 0 },
  suggestionName: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  suggestionPlace: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  bestMatch: { color: '#7EDBFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.7, marginRight: 7 },
  suggestionArrow: { color: 'rgba(255,255,255,0.52)', fontSize: 24, marginTop: -2 },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(86, 14, 27, 0.72)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    marginBottom: 16,
  },
  errorText: { color: '#FFFFFF', flex: 1, fontSize: 13, lineHeight: 18 },
  retryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  loadingState: { height: 420, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { color: 'rgba(255,255,255,0.72)', fontSize: 14 },
  currentCard: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 28,
    padding: 22,
    overflow: 'hidden',
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pin: { color: '#70DAFF', fontSize: 10 },
  location: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', flex: 1 },
  currentWeatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 190,
  },
  temperatureBlock: { flex: 1, minWidth: 0, justifyContent: 'center' },
  temperature: { color: '#FFFFFF', fontSize: 84, lineHeight: 92, fontWeight: '300', letterSpacing: -4 },
  condition: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  feelsLike: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 5 },
  heroIcon: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -6 }],
  },
  heroWeatherArt: {
    width: 116,
    height: 116,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSun: { width: 102, height: 102, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  heroSunRayArm: { position: 'absolute', width: 102, height: 102, alignItems: 'center' },
  heroSunRay: {
    width: 6,
    height: 19,
    borderRadius: 4,
    backgroundColor: '#FFE071',
    shadowColor: '#FFD047',
    shadowOpacity: 0.48,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  heroSunCore: {
    position: 'absolute',
    width: 55,
    height: 55,
    borderRadius: 28,
    alignItems: 'flex-start',
    backgroundColor: '#FFD75A',
    shadowColor: '#FFD047',
    shadowOpacity: 0.62,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  heroSunHighlight: {
    width: 20,
    height: 11,
    borderRadius: 8,
    marginTop: 10,
    marginLeft: 12,
    transform: [{ rotate: '-28deg' }],
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  heroMoon: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  heroMoonGlyph: {
    color: '#E2EEFF',
    fontSize: 104,
    lineHeight: 112,
    fontWeight: '300',
    textShadowColor: 'rgba(122,190,255,0.78)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
    transform: [{ rotate: '-10deg' }],
  },
  heroMoonStar: {
    position: 'absolute',
    color: '#BFE2FF',
    textShadowColor: 'rgba(186,225,255,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 7,
  },
  heroMoonStarLarge: { right: 8, top: 18, fontSize: 18 },
  heroMoonStarSmall: { right: 1, top: 49, fontSize: 20 },
  heroCloud: {
    position: 'absolute',
    right: -1,
    bottom: 3,
    width: 86,
    height: 52,
    opacity: 0.92,
  },
  heroCloudOvercast: { right: 10, bottom: 18, width: 112, height: 68 },
  statsPanel: {
    backgroundColor: 'rgba(6,33,61,0.2)',
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  statItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  statText: { flex: 1, minWidth: 0 },
  statIcon: {
    color: '#70DAFF',
    fontSize: 18,
    lineHeight: 24,
    width: 26,
    textAlign: 'center',
    fontWeight: '700',
  },
  statValue: { color: '#FFFFFF', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.68)', fontSize: 11, lineHeight: 15, marginTop: 1 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.17)', marginHorizontal: 12 },
  statsHorizontalDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 3 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 30,
    marginBottom: 14,
    paddingHorizontal: 3,
  },
  sectionTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { color: 'rgba(255,255,255,0.57)', fontSize: 12, marginTop: 3 },
  calendarIcon: { color: 'rgba(255,255,255,0.8)', fontSize: 24 },
  forecastTabs: {
    flexDirection: 'row',
    marginTop: 30,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
  },
  forecastTab: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  forecastTabPressed: { opacity: 0.7 },
  forecastTabText: { color: 'rgba(255,255,255,0.72)', fontSize: 14, fontWeight: '700' },
  forecastTabTextActive: { color: '#FFFFFF', fontWeight: '900' },
  forecastTabIndicator: {
    position: 'absolute',
    bottom: -1,
    width: '100%',
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  forecastAnimatedPanel: { width: '100%' },
  weeklyIntro: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  weeklyIntroContent: { flex: 1, minWidth: 0 },
  weeklyIntroEyebrow: { color: '#7ED9FF', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  weeklyIntroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 4 },
  weeklyIntroText: { color: 'rgba(255,255,255,0.58)', fontSize: 11, marginTop: 3 },
  weeklyLegend: { color: '#94E4FF', fontSize: 9, fontWeight: '800', marginTop: 8 },
  weeklyIntroIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    backgroundColor: 'rgba(126,217,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(126,217,255,0.26)',
  },
  weeklyIntroIconText: { color: '#B8ECFF', fontSize: 25 },
  hourlyScrollHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 3,
    marginBottom: 10,
  },
  hourlyScrollHintText: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '700' },
  hourlyScrollHintAction: { color: '#9AE6FF', fontSize: 10, fontWeight: '800' },
  hourlyList: { gap: 10, paddingLeft: 2, paddingRight: 20, paddingBottom: 2 },
  hourCard: {
    width: 78,
    minHeight: 142,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(7,34,62,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 22,
    paddingVertical: 13,
    paddingHorizontal: 8,
  },
  currentHourCard: { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.32)' },
  hourTime: { color: 'rgba(255,255,255,0.66)', fontSize: 11, fontWeight: '700' },
  currentHourText: { color: '#FFFFFF', fontWeight: '900' },
  hourIcon: { width: 46, height: 40, alignItems: 'center', justifyContent: 'center' },
  hourTemperature: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  hourRainRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hourDrop: { fontSize: 10 },
  hourRain: { color: '#8BDFFF', fontSize: 10, fontWeight: '700' },
  compactWeatherIcon: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  weatherGlyph: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  celestialGlyph: {
    position: 'absolute',
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  sunGlyph: { textShadowColor: 'rgba(255,200,45,0.6)' },
  moonGlyph: { textShadowColor: 'rgba(117,185,255,0.75)', transform: [{ rotate: '-8deg' }] },
  cloudGlyph: {
    position: 'absolute',
    bottom: 0,
    opacity: 0.9,
  },
  conditionCloud: {
    position: 'absolute',
    top: 0,
    opacity: 0.95,
  },
  precipitationRow: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
  },
  rainStreak: {
    borderRadius: 8,
    backgroundColor: '#76D9FF',
    transform: [{ rotate: '16deg' }],
    shadowColor: '#56C8FF',
    shadowOpacity: 0.55,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
  fogLines: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fogLine: {
    borderRadius: 8,
    backgroundColor: '#D9EEFF',
    opacity: 0.84,
  },
  snowRow: {
    position: 'absolute',
    bottom: -1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  snowFlake: {
    color: '#EAF6FF',
    fontWeight: '900',
    textShadowColor: 'rgba(126,217,255,0.72)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  stormBolt: {
    position: 'absolute',
    bottom: -2,
    color: '#FFD65A',
    fontWeight: '900',
    textShadowColor: 'rgba(255,190,40,0.62)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  forecastCard: {
    gap: 12,
    backgroundColor: 'transparent',
    marginTop: 0,
  },
  forecastDayBlock: {
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 20,
    backgroundColor: '#175B96',
    shadowColor: '#03182B',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  lastForecastDayBlock: { marginBottom: 0 },
  forecastRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#175B96',
  },
  day: { color: 'rgba(255,255,255,0.83)', fontSize: 13, fontWeight: '600', flex: 1.5 },
  today: { color: '#FFFFFF', fontWeight: '800' },
  forecastIcon: { width: 48, height: 46, alignItems: 'center', justifyContent: 'center' },
  rainChance: { width: 48, flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 2 },
  drop: { fontSize: 12 },
  rainText: { color: '#8BDFFF', fontSize: 11, fontWeight: '700' },
  highLowGroup: { width: 76, gap: 3 },
  temperaturePair: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  temperatureLabel: { color: '#8BDFFF', width: 9, fontSize: 8, fontWeight: '900' },
  high: { color: '#FFFFFF', width: 34, textAlign: 'right', fontSize: 14, lineHeight: 17, fontWeight: '800' },
  low: { color: 'rgba(255,255,255,0.58)', width: 34, textAlign: 'right', fontSize: 14, lineHeight: 17, fontWeight: '700' },
  dayChevron: { color: 'rgba(255,255,255,0.55)', fontSize: 22, width: 16, textAlign: 'right', marginLeft: 4 },
  dayChevronOpen: { transform: [{ rotate: '90deg' }], color: '#FFFFFF' },
  dayHourlyDetails: {
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  dayHourlyTitle: { color: 'rgba(255,255,255,0.58)', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 9 },
  dayHourlyList: { gap: 8, paddingRight: 4 },
  dayHourCard: {
    width: 68,
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 17,
    paddingVertical: 9,
    paddingHorizontal: 5,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dayHourTime: { color: 'rgba(255,255,255,0.66)', fontSize: 9, fontWeight: '700' },
  dayHourTemperature: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  dayHourRain: { color: '#8BDFFF', fontSize: 8, fontWeight: '700' },
  attribution: {
    color: 'rgba(255,255,255,0.56)',
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 'auto',
    paddingTop: 24,
  },
});
