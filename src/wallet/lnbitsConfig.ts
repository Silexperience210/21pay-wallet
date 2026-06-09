// LNbits runtime config. API keys are per-user runtime secrets — NEVER hard-coded,
// NEVER committed. Only the (non-secret) base URL comes from a build-time env var.

export interface CustodialLnbitsConfig {
  baseUrl: string;
  adminKey: string;
  invoiceKey: string;
  readKey: string;
}

export function lnbitsBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_LNBITS_URL;
  if (!url) throw new Error('EXPO_PUBLIC_LNBITS_URL is not set');
  return url;
}
