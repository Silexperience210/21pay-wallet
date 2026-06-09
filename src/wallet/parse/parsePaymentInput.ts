// WALLET-04: single-pass classification of a scanned/pasted payment string.
// Pure: never throws, never performs IO, never auto-pays — only classifies.

export type PaymentInputKind = 'bolt11' | 'lnurl' | 'lnaddr' | 'bip21' | 'onchain' | 'unknown';

export type ParsedPayment =
  | { kind: 'bolt11'; invoice: string }
  | { kind: 'lnurl'; lnurl: string }
  | { kind: 'lnaddr'; name: string; domain: string }
  | { kind: 'bip21'; address: string; amountSat?: number; lightning?: string }
  | { kind: 'onchain'; address: string }
  | { kind: 'unknown' };

// Integer-only BTC→sats (no float drift): 0.0001 BTC → exactly 10000 sats.
function btcToSats(btc: string): number {
  const [whole = '0', frac = ''] = btc.split('.');
  const frac8 = (frac + '00000000').slice(0, 8);
  const w = parseInt(whole || '0', 10);
  const f = parseInt(frac8 || '0', 10);
  if (!Number.isFinite(w) || !Number.isFinite(f)) return 0;
  return w * 100_000_000 + f;
}

const BOLT11_RE = /^ln(bc|tb|bcrt)/i;
const ONCHAIN_RE =
  /^((bc1|tb1|bcrt1)[ac-hj-np-z02-9]{6,}|[13mn2][a-km-zA-HJ-NP-Z1-9]{20,})$/;

export function parsePaymentInput(raw: string): ParsedPayment {
  if (!raw || typeof raw !== 'string') return { kind: 'unknown' };
  const s0 = raw.trim();
  const lower0 = s0.toLowerCase();

  // BIP21 (bitcoin: URI, possibly carrying a lightning= param)
  if (lower0.startsWith('bitcoin:')) {
    const body = s0.slice('bitcoin:'.length);
    const qIdx = body.indexOf('?');
    const address = (qIdx >= 0 ? body.slice(0, qIdx) : body).trim();
    const params = new URLSearchParams(qIdx >= 0 ? body.slice(qIdx + 1) : '');
    const out: ParsedPayment = { kind: 'bip21', address };
    const amount = params.get('amount');
    if (amount) out.amountSat = btcToSats(amount);
    const lightning = params.get('lightning');
    if (lightning) out.lightning = lightning;
    return out;
  }

  // Strip a lightning: scheme prefix before classifying the rest.
  const s = lower0.startsWith('lightning:') ? s0.slice('lightning:'.length).trim() : s0;
  const sl = s.toLowerCase();

  if (BOLT11_RE.test(sl)) return { kind: 'bolt11', invoice: s };
  if (sl.startsWith('lnurl1')) return { kind: 'lnurl', lnurl: s };

  if ((s.match(/@/g) || []).length === 1) {
    const [name, domain] = s.split('@');
    if (name && domain && domain.includes('.')) return { kind: 'lnaddr', name, domain };
  }

  if (ONCHAIN_RE.test(s)) return { kind: 'onchain', address: s };

  return { kind: 'unknown' };
}
