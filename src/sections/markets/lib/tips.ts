// Opt-in tip to the operator — the honest, non-coercive way Hunch's infra (mint
// liquidity, oracle LLM credits, hosting) gets supported. Ported from hunch-web/lib/tips.ts.
// A tip is a Lightning payment to the operator's Lightning Address (LNURL-pay), paid
// from the in-app wallet on an explicit tap — never automatic, gracefully surfaced on
// failure. lnAddressToLnurlp is pure + tested; the rest does the LNURL-pay fetch + pay.
import type { SectionCapabilities } from '../../capabilities';

/** Tip presets in sats. 210 = the operator LNURL minSendable nod; 2100 = the 21M nod.
 *  The LNURL-pay flow enforces the live min/max and surfaces an error otherwise. */
export const TIP_PRESETS = [210, 500, 2100] as const;

/** Resolve a `name@domain` Lightning Address to its LNURL-pay endpoint URL. Pure. */
export function lnAddressToLnurlp(address: string): string {
  const [name, domain] = address.trim().split('@');
  if (!name || !domain) throw new Error('invalid Lightning address (expected name@domain)');
  return `https://${domain}/.well-known/lnurlp/${name}`;
}

interface LnurlPayMeta {
  status?: string;
  reason?: string;
  callback?: string;
  minSendable?: number;
  maxSendable?: number;
}

/** Resolve a Lightning Address + amount into a bolt11 invoice via the LNURL-pay flow. */
export async function resolveLnAddressInvoice(address: string, amountSat: number): Promise<string> {
  const meta = (await (await fetch(lnAddressToLnurlp(address))).json()) as LnurlPayMeta;
  if (meta.status === 'ERROR') throw new Error(meta.reason || 'LNURL error');
  if (!meta.callback) throw new Error('LNURL-pay endpoint has no callback');
  const amountMsat = amountSat * 1000;
  if (meta.minSendable && amountMsat < meta.minSendable) throw new Error('tip below the operator minimum');
  if (meta.maxSendable && amountMsat > meta.maxSendable) throw new Error('tip above the operator maximum');
  const cb = new URL(meta.callback);
  cb.searchParams.set('amount', String(amountMsat));
  const res = (await (await fetch(cb.toString())).json()) as { pr?: string; invoice?: string; reason?: string };
  const invoice = res.pr ?? res.invoice;
  if (!invoice) throw new Error(res.reason || 'LNURL-pay returned no invoice');
  return invoice;
}

/** Resolve the operator invoice for `amountSat` and pay it from the in-app wallet.
 *  Explicit, opt-in (caller gates it behind a tap); throws a human-meaningful message. */
export async function sendTip(caps: SectionCapabilities, address: string, amountSat: number): Promise<void> {
  if (!Number.isInteger(amountSat) || amountSat < 1) throw new Error('tip amount must be >= 1 sat');
  const invoice = await resolveLnAddressInvoice(address, amountSat);
  await caps.wallet.payInvoice(invoice);
}
