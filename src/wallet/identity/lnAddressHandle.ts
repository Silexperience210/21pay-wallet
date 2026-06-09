// WALLET-08: validate a name@21pay handle before any claim (LNbits LNURLp rules).
import { lnbitsBaseUrl } from '../lnbitsConfig';

const HANDLE_RE = /^[a-z0-9_-]{1,32}$/; // lowercase, digits, - and _ ; 1..32
const RESERVED = ['admin', 'root', 'support', '21pay', 'lnbits', 'satoshi'];

// The @21pay domain, derived from the LNbits URL host with a safe fallback.
export const LN_ADDRESS_DOMAIN: string = (() => {
  try {
    return new URL(lnbitsBaseUrl()).hostname;
  } catch {
    return '21pay.org';
  }
})();

export function validateLnAddressHandle(name: string): { valid: boolean; reason?: string } {
  if (!name) return { valid: false, reason: 'Pick a name.' };
  if (name.length > 32) return { valid: false, reason: '32 characters max.' };
  if (!HANDLE_RE.test(name)) {
    return { valid: false, reason: 'Lowercase letters, digits, - and _ only.' };
  }
  if (RESERVED.includes(name.toLowerCase())) return { valid: false, reason: 'That name is reserved.' };
  return { valid: true };
}
