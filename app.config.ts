import { ExpoConfig } from 'expo/config';

// Authoritative Expo config (TypeScript). app.json is intentionally NOT used —
// app.config.ts wins when both exist. Prebuild + dev-client + expo-router.
const config: ExpoConfig = {
  name: '21pay',
  slug: '21pay-wallet',
  owner: 'silexperience',
  version: '0.9.4',
  orientation: 'portrait',
  scheme: 'pay21',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#050505',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#050505',
  },
  assetBundlePatterns: ['**/*'],
  // SDK 54 Legacy Architecture opt-in so Moti 0.30 / Reanimated 3 work cleanly
  // (Reanimated 4 is New-Architecture-only and breaks Moti — CLAUDE.md constraint 1).
  newArchEnabled: false,
  android: {
    package: 'org.pay21.wallet',
    // OS auto-backup disabled so future secret-bearing app data is never
    // exfiltrated to cloud backup (CLAUDE.md constraint 3 / 6).
    allowBackup: false,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#050505',
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-sqlite',
    'expo-font',
    [
      'expo-camera',
      { cameraPermission: 'Scan a Lightning or on-chain QR code to pay or receive.' },
    ],
    [
      'expo-image-picker',
      { photosPermission: 'Pick an image or video to publish as paid content.' },
    ],
    [
      'react-native-nfc-manager',
      { nfcPermission: 'Tap to pay or receive Bitcoin over NFC.' },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#050505',
        image: './assets/splash-logo.png',
        resizeMode: 'contain',
        dark: {
          backgroundColor: '#050505',
          image: './assets/splash-logo.png',
          resizeMode: 'contain',
        },
        android: {
          backgroundColor: '#050505',
          image: './assets/splash-logo.png',
          resizeMode: 'contain',
        },
      },
    ],
    // Local plugin: registers the HCE HostApduService so the phone can emulate an NFC
    // tag carrying a Lightning invoice (receive-by-tap without a physical tag).
    './plugins/withHce',
  ],
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
