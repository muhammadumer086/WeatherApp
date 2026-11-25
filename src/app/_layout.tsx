import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SettingsViewModelProvider } from '@/features/settings/view-models/settings-view-model';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SettingsViewModelProvider>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }} />
    </SettingsViewModelProvider>
  );
}
