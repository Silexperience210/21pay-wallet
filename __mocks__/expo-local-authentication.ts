// Jest manual mock for expo-local-authentication (node env has no biometrics).

let authResult = true;

export async function hasHardwareAsync(): Promise<boolean> {
  return true;
}
export async function isEnrolledAsync(): Promise<boolean> {
  return true;
}
export async function supportedAuthenticationTypesAsync(): Promise<number[]> {
  return [];
}
export async function authenticateAsync(): Promise<{ success: boolean; error?: string }> {
  return authResult ? { success: true } : { success: false, error: 'user_cancel' };
}

// --- test helpers ---
export function __setAuthResult(ok: boolean): void {
  authResult = ok;
}
