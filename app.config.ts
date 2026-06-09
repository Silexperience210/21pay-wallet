import { ExpoConfig } from 'expo/config';

// Authoritative Expo config (TypeScript). app.json is intentionally NOT used —
// app.config.ts wins when both exist. Prebuild + dev-client + expo-router.
const config: ExpoConfig = {
  name: '21pay',
  slug: '21pay-wallet',
  owner: 'silexperience',
  version: '0.0.1',
  orientation: 'portrait',
  scheme: 'pay21',
  userInterfaceStyle: 'automatic',
  // SDK 54 Legacy Architecture opt-in so Moti 0.30 / Reanimated 3 work cleanly
  // (Reanimated 4 is New-Architecture-only and breaks Moti — CLAUDE.md constraint 1).
  newArchEnabled: false,
  android: {
    package: 'org.pay21.wallet',
    // OS auto-backup disabled so future secret-bearing app data is never
    // exfiltrated to cloud backup (CLAUDE.md constraint 3 / 6).
    allowBackup: false,
  },
  plugins: ['expo-router', 'expo-secure-store'],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: 'e961ee21-0aa8-4e9a-bd9d-173b42311895',
    },
  },
};

export default config;
