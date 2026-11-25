import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppearanceMode,
  TemperatureUnit,
  TimeFormat,
  WindUnit,
} from '@/features/settings/models/weather-settings';
import { useSettingsViewModel } from '@/features/settings/view-models/settings-view-model';

type Option<T extends string> = { label: string; value: T };

function OptionGroup<T extends string>({
  options,
  value,
  onChange,
  isNightTheme,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  isNightTheme: boolean;
}) {
  return (
    <View style={[styles.optionGroup, !isNightTheme && styles.optionGroupDay]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.optionButton,
              selected && styles.optionButtonSelected,
              selected && !isNightTheme && styles.optionButtonSelectedDay,
              pressed && styles.pressed,
            ]}>
            <Text style={[
              styles.optionText,
              selected && styles.optionTextSelected,
              selected && !isNightTheme && styles.optionTextSelectedDay,
            ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
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
    isNightTheme: weatherIsNight,
  } = useSettingsViewModel();
  const isNightTheme = appearance === 'night' || (appearance === 'auto' && weatherIsNight);

  return (
    <View style={[styles.screen, !isNightTheme && styles.screenDay]}>
      <StatusBar style="light" />
      <View pointerEvents="none" style={[styles.glow, !isNightTheme && styles.glowDay]} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 },
        ]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back to weather"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>SKYCAST</Text>
            <Text style={styles.title}>Settings</Text>
          </View>
        </View>

        <Text style={styles.intro}>Personalize your weather experience</Text>

        <View style={styles.settingsList}>
          <View style={[styles.settingBlock, !isNightTheme && styles.settingBlockDay]}>
            <View style={styles.settingHeading}>
              <View style={styles.settingIcon}><Text style={styles.settingIconText}>◷</Text></View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Time format</Text>
                <Text style={styles.settingDescription}>Forecast and update times</Text>
              </View>
            </View>
            <OptionGroup<TimeFormat>
              value={timeFormat}
              onChange={setTimeFormat}
              isNightTheme={isNightTheme}
              options={[
                { label: '12h', value: '12h' },
                { label: '24h', value: '24h' },
              ]}
            />
          </View>

          <View style={[styles.settingBlock, !isNightTheme && styles.settingBlockDay]}>
            <View style={styles.settingHeading}>
              <View style={styles.settingIcon}><Text style={styles.settingIconText}>♨</Text></View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Temperature</Text>
                <Text style={styles.settingDescription}>Current and forecast values</Text>
              </View>
            </View>
            <OptionGroup<TemperatureUnit>
              value={temperatureUnit}
              onChange={setTemperatureUnit}
              isNightTheme={isNightTheme}
              options={[
                { label: '°C', value: 'celsius' },
                { label: '°F', value: 'fahrenheit' },
              ]}
            />
          </View>

          <View style={[styles.settingBlock, !isNightTheme && styles.settingBlockDay]}>
            <View style={styles.settingHeading}>
              <View style={styles.settingIcon}><Text style={styles.settingIconText}>≋</Text></View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Wind speed</Text>
                <Text style={styles.settingDescription}>Preferred wind measurement</Text>
              </View>
            </View>
            <OptionGroup<WindUnit>
              value={windUnit}
              onChange={setWindUnit}
              isNightTheme={isNightTheme}
              options={[
                { label: 'km/h', value: 'kmh' },
                { label: 'mph', value: 'mph' },
              ]}
            />
          </View>

          <View style={[styles.settingBlock, !isNightTheme && styles.settingBlockDay]}>
            <View style={styles.settingHeading}>
              <View style={styles.settingIcon}><Text style={styles.settingIconText}>◐</Text></View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Appearance</Text>
                <Text style={styles.settingDescription}>Changes colors only; weather icons follow the actual local time</Text>
              </View>
            </View>
            <OptionGroup<AppearanceMode>
              value={appearance}
              onChange={setAppearance}
              isNightTheme={isNightTheme}
              options={[
                { label: 'Auto', value: 'auto' },
                { label: 'Day', value: 'day' },
                { label: 'Night', value: 'night' },
              ]}
            />
          </View>

          <View style={[styles.settingBlock, !isNightTheme && styles.settingBlockDay]}>
            <View style={styles.toggleRow}>
              <View style={styles.settingIcon}><Text style={styles.settingIconText}>≈</Text></View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Show “feels like”</Text>
                <Text style={styles.settingDescription}>Apparent temperature below conditions</Text>
              </View>
              <Switch
                value={showFeelsLike}
                onValueChange={setShowFeelsLike}
                trackColor={{ false: '#26334A', true: '#3196F3' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050B18' },
  screenDay: { backgroundColor: '#1D74C9' },
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    right: -120,
    top: -120,
    backgroundColor: 'rgba(42, 139, 230, 0.14)',
  },
  glowDay: { backgroundColor: 'rgba(126,219,255,0.12)' },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  backIcon: { color: '#FFFFFF', fontSize: 34, lineHeight: 36, marginTop: -3 },
  headerText: { flex: 1 },
  eyebrow: { color: 'rgba(255,255,255,0.58)', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  title: { color: '#FFFFFF', fontSize: 30, lineHeight: 35, fontWeight: '800', letterSpacing: -0.7 },
  intro: { color: 'rgba(255,255,255,0.54)', fontSize: 13, lineHeight: 19, marginTop: 12, marginBottom: 18 },
  settingsList: { gap: 10 },
  settingBlock: {
    gap: 13,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  settingBlockDay: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  settingHeading: { flexDirection: 'row', alignItems: 'center' },
  settingIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(55,153,244,0.13)', marginRight: 10 },
  settingIconText: { color: '#6DC5FF', fontSize: 18, fontWeight: '700' },
  settingCopy: { flex: 1 },
  settingTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  settingDescription: { color: 'rgba(255,255,255,0.48)', fontSize: 10, lineHeight: 15, marginTop: 2 },
  optionGroup: { flexDirection: 'row', backgroundColor: '#202A3B', borderRadius: 13, padding: 3, gap: 3 },
  optionGroupDay: { backgroundColor: 'rgba(7,48,88,0.22)' },
  optionButton: { flex: 1, minHeight: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  optionButtonSelected: { backgroundColor: '#3196F3', shadowColor: '#3196F3', shadowOpacity: 0.28, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  optionButtonSelectedDay: { backgroundColor: '#FFFFFF', shadowColor: '#07345F' },
  optionText: { color: 'rgba(255,255,255,0.62)', fontSize: 11, fontWeight: '700' },
  optionTextSelected: { color: '#FFFFFF' },
  optionTextSelectedDay: { color: '#176CB6' },
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },

      aboutButton: {
      padding: 16,
      borderRadius: 18,
      backgroundColor: '#111827',
    },
    aboutButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
});
