// Jest manual mock for expo-secure-store (node env has no native SecureStore).

let store: Record<string, string> = {};
const authFlags: Record<string, boolean> = {};

export interface SecureStoreOptions {
  requireAuthentication?: boolean;
  keychainService?: string;
  authenticationPrompt?: string;
}

export async function setItemAsync(
  key: string,
  value: string,
  options?: SecureStoreOptions,
): Promise<void> {
  store[key] = value;
  authFlags[key] = options?.requireAuthentication ?? false;
}

export async function getItemAsync(
  key: string,
  _options?: SecureStoreOptions,
): Promise<string | null> {
  return key in store ? store[key] : null;
}

export async function deleteItemAsync(key: string, _options?: SecureStoreOptions): Promise<void> {
  delete store[key];
  delete authFlags[key];
}

export async function isAvailableAsync(): Promise<boolean> {
  return true;
}

// --- test helpers ---
export function __requiredAuth(key: string): boolean {
  return authFlags[key] ?? false;
}
export function __reset(): void {
  store = {};
}
