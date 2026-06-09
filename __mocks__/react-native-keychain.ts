// Jest manual mock for react-native-keychain (node env has no native Keystore).
// Auto-applied by Jest for node_modules mocks placed in root __mocks__/.

type Entry = { username: string; password: string };
let store: Record<string, Entry> = {};
let securityLevel = 'SECURE_HARDWARE';
let failHardware = false;

export const ACCESS_CONTROL = {
  BIOMETRY_CURRENT_SET: 'BiometryCurrentSet',
  BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE: 'BiometryCurrentSetOrDevicePasscode',
  DEVICE_PASSCODE: 'DevicePasscode',
} as const;

export const ACCESSIBLE = {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly',
  WHEN_UNLOCKED: 'AccessibleWhenUnlocked',
} as const;

export const SECURITY_LEVEL = {
  SECURE_SOFTWARE: 'SECURE_SOFTWARE',
  SECURE_HARDWARE: 'SECURE_HARDWARE',
  ANY: 'ANY',
} as const;

export const STORAGE_TYPE = {
  AES_GCM: 'AES_GCM',
  AES_GCM_NO_AUTH: 'AES_GCM_NO_AUTH',
  RSA: 'RSA',
} as const;

export const BIOMETRY_TYPE = {
  FINGERPRINT: 'Fingerprint',
  FACE: 'Face',
} as const;

function svc(options?: { service?: string }): string {
  return options?.service ?? 'default';
}

export async function setGenericPassword(
  username: string,
  password: string,
  options?: { service?: string; securityLevel?: string },
): Promise<boolean> {
  if (failHardware && options?.securityLevel === SECURITY_LEVEL.SECURE_HARDWARE) {
    throw new Error('StrongBoxUnavailableException (mock)');
  }
  store[svc(options)] = { username, password };
  return true;
}

export async function getGenericPassword(
  options?: { service?: string },
): Promise<false | { username: string; password: string; service: string; storage: string }> {
  const e = store[svc(options)];
  if (!e) return false;
  return { ...e, service: svc(options), storage: STORAGE_TYPE.AES_GCM };
}

export async function resetGenericPassword(options?: { service?: string }): Promise<boolean> {
  delete store[svc(options)];
  return true;
}

export async function getSecurityLevel(): Promise<string> {
  return securityLevel;
}

export async function getSupportedBiometryType(): Promise<string | null> {
  return BIOMETRY_TYPE.FINGERPRINT;
}

// --- test helpers ---
export function __setSecurityLevel(level: string): void {
  securityLevel = level;
}
export function __setHardwareFailure(fail: boolean): void {
  failHardware = fail;
}
export function __reset(): void {
  store = {};
  securityLevel = 'SECURE_HARDWARE';
  failHardware = false;
}
