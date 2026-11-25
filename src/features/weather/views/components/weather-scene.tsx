import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';

export type WeatherSceneKind =
  | 'clear'
  | 'partly-cloudy'
  | 'overcast'
  | 'fog'
  | 'rain'
  | 'heavy-rain'
  | 'storm'
  | 'snow';

type WeatherPalette = {
  colors: readonly [string, string, ...string[]];
  accent: string;
};

const RAIN_DROPS = Array.from({ length: 24 }, (_, index) => ({
  left: `${(index * 37 + 7) % 100}%` as `${number}%`,
  top: -40 - ((index * 53) % 420),
  height: 14 + (index % 4) * 4,
  opacity: 0.25 + (index % 5) * 0.1,
}));

const SNOWFLAKES = Array.from({ length: 18 }, (_, index) => ({
  left: `${(index * 43 + 11) % 100}%` as `${number}%`,
  top: -30 - ((index * 67) % 460),
  size: 4 + (index % 4) * 2,
  opacity: 0.45 + (index % 4) * 0.12,
}));

export function weatherSceneKind(code: number): WeatherSceneKind {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly-cloudy';
  if (code === 3) return 'overcast';
  if (code <= 48) return 'fog';
  if (code === 65 || code === 67 || code === 82) return 'heavy-rain';
  if (code <= 67 || (code >= 80 && code <= 81)) return 'rain';
  if (code <= 86) return 'snow';
  return 'storm';
}

export function weatherPalette(code: number, isNight: boolean): WeatherPalette {
  const kind = weatherSceneKind(code);

  if (isNight) {
    if (kind === 'storm') return { colors: ['#080B1C', '#121A36', '#07111F'], accent: '#8EA7D6' };
    if (kind === 'rain' || kind === 'heavy-rain') {
      return { colors: ['#071523', '#0A2A43', '#07131F'], accent: '#65BCEB' };
    }
    if (kind === 'snow') return { colors: ['#10243A', '#284866', '#13263B'], accent: '#D9F3FF' };
    if (kind === 'fog' || kind === 'overcast') {
      return { colors: ['#142536', '#2B4357', '#122332'], accent: '#B6CFDD' };
    }
    return { colors: ['#050B1C', '#0A2140', '#103A64'], accent: '#FFF0B5' };
  }

  if (kind === 'storm') return { colors: ['#26384E', '#344C66', '#17293C'], accent: '#B9D5E8' };
  if (kind === 'heavy-rain') return { colors: ['#274E68', '#356B8A', '#183A53'], accent: '#82CEF2' };
  if (kind === 'rain') return { colors: ['#386D8D', '#397FA8', '#245473'], accent: '#9DDEFA' };
  if (kind === 'snow') return { colors: ['#7DA3BA', '#9BC5DA', '#5E839C'], accent: '#F4FCFF' };
  if (kind === 'fog') return { colors: ['#7895A7', '#9AB2BF', '#668393'], accent: '#E3EFF4' };
  if (kind === 'overcast') return { colors: ['#4A6C82', '#66899E', '#3B6078'], accent: '#D8E7EF' };
  if (kind === 'partly-cloudy') return { colors: ['#2588DA', '#4AA8EA', '#1670BE'], accent: '#FFE07A' };
  return { colors: ['#1688E3', '#48B5F4', '#1172C8'], accent: '#FFD65A' };
}

function useLoop(duration: number, active: boolean) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (!active) return;

    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [active, duration, progress]);

  return progress;
}

export function WeatherScene({ code, isNight, active }: { code: number; isNight: boolean; active: boolean }) {
  const { height } = useWindowDimensions();
  const kind = weatherSceneKind(code);
  const palette = weatherPalette(code, isNight);
  const fogMotion = useLoop(17000, active && kind === 'fog');
  const precipitationMotion = useLoop(kind === 'snow' ? 6500 : 1900, active);
  const [lightning] = useState(() => new Animated.Value(0));

  useEffect(() => {
    lightning.stopAnimation();
    lightning.setValue(0);
    if (!active || kind !== 'storm') return;

    const flash = Animated.loop(
      Animated.sequence([
        Animated.delay(8200),
        Animated.timing(lightning, { toValue: 0.3, duration: 90, useNativeDriver: true }),
        Animated.timing(lightning, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]),
    );
    flash.start();
    return () => flash.stop();
  }, [active, kind, lightning]);

  const fallDistance = precipitationMotion.interpolate({ inputRange: [0, 1], outputRange: [0, height + 520] });
  const snowDrift = precipitationMotion.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-8, 18, -8] });
  const fogTranslate = fogMotion.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-35, 45, -35] });
  const showRain = ['rain', 'heavy-rain', 'storm'].includes(kind);
  const rainCount = kind === 'rain' ? 14 : 24;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={palette.colors} style={StyleSheet.absoluteFill} />

      {kind === 'fog' ? (
        <Animated.View style={[styles.fogLayer, { transform: [{ translateX: fogTranslate }] }]}>
          <View style={[styles.fogBand, styles.fogBandOne]} />
          <View style={[styles.fogBand, styles.fogBandTwo]} />
          <View style={[styles.fogBand, styles.fogBandThree]} />
        </Animated.View>
      ) : null}

      {showRain ? (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: fallDistance }] }]}>
          {RAIN_DROPS.slice(0, rainCount).map((drop, index) => (
            <View key={index} style={[styles.rainDrop, drop, kind !== 'rain' && styles.rainDropHeavy]} />
          ))}
        </Animated.View>
      ) : null}

      {kind === 'snow' ? (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: fallDistance }, { translateX: snowDrift }] }]}>
          {SNOWFLAKES.map((flake, index) => (
            <View
              key={index}
              style={[styles.snowflake, flake, { width: flake.size, height: flake.size, borderRadius: flake.size / 2 }]}
            />
          ))}
        </Animated.View>
      ) : null}

      <Animated.View style={[StyleSheet.absoluteFill, styles.lightning, { opacity: lightning }]} />
      <LinearGradient
        colors={['rgba(0,0,0,0)', isNight ? 'rgba(0,8,20,0.2)' : 'rgba(7,49,89,0.08)']}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rainDrop: {
    position: 'absolute',
    width: 1.5,
    borderRadius: 1,
    backgroundColor: '#BDEBFF',
    transform: [{ rotate: '10deg' }],
  },
  rainDropHeavy: { width: 2, backgroundColor: '#A9DDF6' },
  snowflake: { position: 'absolute', backgroundColor: '#F4FBFF' },
  fogLayer: { position: 'absolute', top: 130, right: 0, bottom: 0, left: 0 },
  fogBand: { position: 'absolute', height: 48, borderRadius: 28, backgroundColor: 'rgba(235,245,248,0.22)' },
  fogBandOne: { top: 80, left: -40, width: '92%' },
  fogBandTwo: { top: 170, right: -70, width: '105%' },
  fogBandThree: { top: 270, left: -90, width: '115%' },
  lightning: { backgroundColor: '#EAF5FF' },
});
