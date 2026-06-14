// ContentWall client — the 21pay LNbits extension (Silexperience210/contentwall,
// installed on 21pay.org) made native. Two surfaces:
//  - BUYER (public, no auth): public item → invoice → pay (via useWallet, never
//    here) → check → signed content URL. Purchases re-open via /me/purchases —
//    knowing a payment_hash already proves access (extension's own model).
//  - CREATOR (keyed): the custodial 21pay wallet's LNbits keys ARE the creator
//    keys — list items (invoice key), create (admin key), stats (invoice key).
// This is an app-level (first-party) feature like the LN-address claim, NOT a
// section: it needs the LNbits credential tier (getActiveCustodialConfig).
import { httpRequest } from '../core/net';
import type { CustodialLnbitsConfig } from './lnbitsConfig';

const LNBITS_URL = (): string => process.env.EXPO_PUBLIC_LNBITS_URL ?? 'https://21pay.org';
const API = '/contentwall/api/v1';

// ── Types (mirrors models.py) ─────────────────────────────────────────────────

export interface PublicItem {
  id: string;
  title: string;
  description: string;
  content_type: 'article' | 'image' | 'bundle' | 'audio' | 'video' | string;
  amount: number;
  currency: string;
  memo: string;
  teaser_text?: string | null;
  release_delay_seconds: number;
  access_duration_seconds: number;
  max_views: number;
  file_count: number;
  markdown: boolean;
}

export interface ItemPreview {
  content_type: string;
  teaser_text?: string | null;
  /** data: URI for blurred image previews. */
  preview_data?: string;
  files?: { name: string; size: number }[];
}

export interface UnlockQuote {
  payment_hash: string;
  payment_request: string;
  amount: number;
  coupon_applied?: string | null;
}

export interface UnlockStatus {
  paid: boolean;
  expired?: boolean;
  /** Signed content URL (carries payment_hash + access token). */
  url?: string;
  content_unlocked?: boolean;
  unlock_in_seconds?: number | null;
  expires_at?: string | null;
}

export interface ContentwallItem extends PublicItem {
  wallet: string;
  created_at?: string;
  archived_at?: string | null;
}

// Mirrors the extension's ItemStats (crud.get_item_stats / models.ItemStats):
// payment_count = sales, total_sats = revenue. The studio maps these to its
// "{sales} ventes · {revenue} sats" line — do NOT rename to sales/revenue here,
// those keys are not in the JSON and silently read as 0.
export interface ItemStats {
  item_id?: string;
  payment_count?: number;
  total_sats?: number;
  unique_payers?: number;
  last_payment_at?: string | null;
  [k: string]: unknown;
}

export interface StoredPurchase {
  itemId: string;
  paymentHash: string;
  title: string;
  savedAt: number;
}

// ── Input parsing ─────────────────────────────────────────────────────────────

/** Accepts a pasted ContentWall link (…/contentwall/{id}, …/contentwall/embed/{id},
 *  signed content URLs) or a bare item id. Returns the item id, or null. */
export function parseContentwallInput(raw: string): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  const urlMatch = s.match(/\/contentwall\/(?:embed\/|content\/)?([A-Za-z0-9_-]{8,64})/);
  if (urlMatch) return urlMatch[1];
  if (/^[A-Za-z0-9_-]{8,64}$/.test(s) && !s.includes('://')) return s;
  return null;
}

// ── Buyer (public) ────────────────────────────────────────────────────────────

/** Public JSON slice (endpoint added in contentwall fc9f735). Returns null when the
 *  deployed extension predates it — callers fall back to preview + invoice amount. */
export async function getPublicItem(itemId: string): Promise<PublicItem | null> {
  try {
    const res = await httpRequest<PublicItem>({
      baseUrl: LNBITS_URL(),
      path: `${API}/items/${encodeURIComponent(itemId)}/public`,
      idempotent: true,
    });
    return res.data?.id ? res.data : null;
  } catch {
    return null; // older extension without /public — degrade gracefully
  }
}

/** Safe-to-share teaser (article excerpt / blurred image / bundle file list). */
export async function getPreview(itemId: string): Promise<ItemPreview | null> {
  try {
    const res = await httpRequest<ItemPreview>({
      baseUrl: LNBITS_URL(),
      path: `${API}/items/${encodeURIComponent(itemId)}/preview`,
      idempotent: true,
    });
    return res.data ?? null;
  } catch {
    return null;
  }
}

/** POST /items/invoice/{id} → bolt11 quote. Amount omitted = the item's floor price
 *  (so this also DISCOVERS the price on pre-/public extensions). NEVER pays. */
export async function createUnlockInvoice(
  itemId: string,
  opts?: { amount?: number; couponCode?: string },
): Promise<UnlockQuote> {
  const res = await httpRequest<UnlockQuote>({
    baseUrl: LNBITS_URL(),
    path: `${API}/items/invoice/${encodeURIComponent(itemId)}`,
    method: 'POST',
    body: {
      ...(opts?.amount ? { amount: opts.amount } : {}),
      ...(opts?.couponCode ? { coupon_code: opts.couponCode } : {}),
    },
    idempotent: false, // mints an invoice + is rate-limited — never blind-retried
  });
  return res.data;
}

/** POST /items/check/{id} — paid? Returns the SIGNED content URL when unlocked. */
export async function checkUnlock(itemId: string, paymentHash: string): Promise<UnlockStatus> {
  const res = await httpRequest<UnlockStatus>({
    baseUrl: LNBITS_URL(),
    path: `${API}/items/check/${encodeURIComponent(itemId)}`,
    method: 'POST',
    body: { payment_hash: paymentHash },
    idempotent: true, // read-only status probe
  });
  return res.data;
}

/** Poll checkUnlock until paid (the wallet just paid — settlement is near-instant
 *  on the same LNbits) or attempts run out. */
export async function pollUnlock(
  itemId: string,
  paymentHash: string,
  opts?: { intervalMs?: number; maxAttempts?: number; sleep?: (ms: number) => Promise<void> },
): Promise<UnlockStatus> {
  const interval = opts?.intervalMs ?? 1500;
  const max = opts?.maxAttempts ?? 20;
  const sleep = opts?.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last: UnlockStatus = { paid: false };
  for (let i = 0; i < max; i++) {
    try {
      last = await checkUnlock(itemId, paymentHash);
      if (last.paid) return last;
    } catch {
      /* transient */
    }
    if (i < max - 1) await sleep(interval);
  }
  return last;
}

export interface PurchaseRecord {
  item_id: string;
  title?: string;
  content_type?: string;
  payment_hash: string;
  /** Signed access token — combined with the payment_hash into the content URL. */
  token?: string;
  archived?: boolean;
  expires_at?: string | null;
}

/** POST /me/purchases — re-derive items + access tokens from stored hashes.
 *  NOTE: the endpoint returns a TOKEN, not a ready URL (crud.get_purchases_by_hashes);
 *  the client builds the signed content URL itself, like the web UI does. */
export async function fetchPurchases(hashes: string[]): Promise<PurchaseRecord[]> {
  if (hashes.length === 0) return [];
  const res = await httpRequest<PurchaseRecord[]>({
    baseUrl: LNBITS_URL(),
    path: `${API}/me/purchases`,
    method: 'POST',
    body: { hashes },
    idempotent: true,
  });
  return Array.isArray(res.data) ? res.data : [];
}

/** The signed content URL for a purchase (mirrors the server's own construction in
 *  api_check_payment: /contentwall/content/{id}?payment_hash=…&t=…). */
export function purchaseContentUrl(p: PurchaseRecord): string {
  const qs = `payment_hash=${encodeURIComponent(p.payment_hash)}${p.token ? `&t=${encodeURIComponent(p.token)}` : ''}`;
  return `${LNBITS_URL()}/contentwall/content/${encodeURIComponent(p.item_id)}?${qs}`;
}

// ── Creator (LNbits-keyed — the custodial wallet's own keys) ──────────────────

function keyHeaders(key: string): Record<string, string> {
  return { 'X-Api-Key': key };
}

/** GET /items (invoice key) — the creator's items on this wallet. */
export async function listMyItems(cfg: CustodialLnbitsConfig): Promise<ContentwallItem[]> {
  const res = await httpRequest<ContentwallItem[]>({
    baseUrl: LNBITS_URL(),
    path: `${API}/items`,
    headers: keyHeaders(cfg.invoiceKey),
    idempotent: true,
  });
  return Array.isArray(res.data) ? res.data : [];
}

/** POST /items (admin key) — publish a paid ARTICLE (v1 native creator scope). */
export async function createArticleItem(
  cfg: CustodialLnbitsConfig,
  opts: { title: string; amountSat: number; content: string; teaser?: string; markdown?: boolean },
): Promise<ContentwallItem> {
  if (!opts.title.trim()) throw new Error('title required');
  if (!Number.isInteger(opts.amountSat) || opts.amountSat < 1) throw new Error('amount must be >= 1 sat');
  if (!opts.content.trim()) throw new Error('content required');
  const res = await httpRequest<ContentwallItem>({
    baseUrl: LNBITS_URL(),
    path: `${API}/items`,
    method: 'POST',
    body: {
      title: opts.title.trim(),
      description: '',
      content_type: 'article',
      article_content: opts.content,
      amount: opts.amountSat,
      currency: 'sat',
      memo: opts.title.trim().slice(0, 64),
      ...(opts.teaser ? { teaser_text: opts.teaser } : {}),
      markdown: opts.markdown ?? true,
    },
    headers: keyHeaders(cfg.adminKey),
    idempotent: false, // creates a resource
  });
  return res.data;
}

export type MediaContentType = 'image' | 'audio' | 'video' | 'bundle';

/** POST /items (admin key) — create a MEDIA item shell (image/audio/video/bundle).
 *  The actual file(s) are pushed right after via uploadItemFile. */
export async function createMediaItem(
  cfg: CustodialLnbitsConfig,
  opts: { title: string; amountSat: number; contentType: MediaContentType; teaser?: string },
): Promise<ContentwallItem> {
  if (!opts.title.trim()) throw new Error('title required');
  if (!Number.isInteger(opts.amountSat) || opts.amountSat < 1) throw new Error('amount must be >= 1 sat');
  const res = await httpRequest<ContentwallItem>({
    baseUrl: LNBITS_URL(),
    path: `${API}/items`,
    method: 'POST',
    body: {
      title: opts.title.trim(),
      description: '',
      content_type: opts.contentType,
      amount: opts.amountSat,
      currency: 'sat',
      memo: opts.title.trim().slice(0, 64),
      ...(opts.teaser ? { teaser_text: opts.teaser } : {}),
    },
    headers: keyHeaders(cfg.adminKey),
    idempotent: false,
  });
  return res.data;
}

export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
}

/** POST /items/{id}/archive (admin key) — soft-delete / unpublish the item.
 *  Past buyers keep access; new purchases are blocked and the item disappears
 *  from creator lists unless 'Show archived' is enabled. */
export async function archiveItem(cfg: CustodialLnbitsConfig, itemId: string): Promise<void> {
  await httpRequest<{ archived: boolean }>({
    baseUrl: LNBITS_URL(),
    path: `${API}/items/${encodeURIComponent(itemId)}/archive`,
    method: 'POST',
    headers: keyHeaders(cfg.adminKey),
    idempotent: false,
  });
}

/** DELETE /items/{id} (admin key) — hard delete the item and all its files.
 *  Use with care: this permanently removes content and payment history. */
export async function deleteItem(cfg: CustodialLnbitsConfig, itemId: string): Promise<void> {
  await httpRequest<{ deleted: boolean }>({
    baseUrl: LNBITS_URL(),
    path: `${API}/items/${encodeURIComponent(itemId)}`,
    method: 'DELETE',
    headers: keyHeaders(cfg.adminKey),
    idempotent: false,
  });
}

/** Multipart upload of a picked file to the right extension endpoint by type:
 *  image → /upload · audio/video → /upload-media · bundle → /files (repeatable).
 *  Field name is `upload_file` (FastAPI UploadFile); the server validates the real
 *  content by MAGIC BYTES, not the client mime (mobile mimes are unreliable —
 *  handled extension-side by design). Uses fetch directly (core/net httpRequest
 *  is JSON-only). */
export async function uploadItemFile(
  cfg: CustodialLnbitsConfig,
  itemId: string,
  contentType: MediaContentType,
  file: PickedFile,
): Promise<void> {
  const endpoint =
    contentType === 'image'
      ? `${API}/items/${encodeURIComponent(itemId)}/upload`
      : contentType === 'bundle'
        ? `${API}/items/${encodeURIComponent(itemId)}/files`
        : `${API}/items/${encodeURIComponent(itemId)}/upload-media`;
  const form = new FormData();
  // React Native FormData file part: { uri, name, type }.
  form.append('upload_file', {
    uri: file.uri,
    name: file.name || 'upload.bin',
    type: file.mimeType || 'application/octet-stream',
  } as unknown as Blob);
  const res = await fetch(`${LNBITS_URL()}${endpoint}`, {
    method: 'POST',
    headers: { 'X-Api-Key': cfg.adminKey }, // Content-Type set by fetch (boundary)
    body: form,
  });
  if (!res.ok) {
    let detail = `upload failed (${res.status})`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {
      /* keep status message */
    }
    throw new Error(detail);
  }
}

/** GET /stats/items/{id} (invoice key). */
export async function getItemStats(cfg: CustodialLnbitsConfig, itemId: string): Promise<ItemStats | null> {
  try {
    const res = await httpRequest<ItemStats>({
      baseUrl: LNBITS_URL(),
      path: `${API}/stats/items/${encodeURIComponent(itemId)}`,
      headers: keyHeaders(cfg.invoiceKey),
      idempotent: true,
    });
    return res.data ?? null;
  } catch {
    return null;
  }
}

/** Maps the extension's ItemStats onto the creator-facing summary the Studio
 *  renders ("{sales} ventes · {revenue} sats"). Lives here (not inline in the
 *  screen) so the field mapping is unit-tested: payment_count→sales,
 *  total_sats→revenue. Renaming a backend field then breaks the test loudly
 *  instead of silently showing 0 (the original ContentWall stats bug). */
export function statsSummary(s: ItemStats | null | undefined): { sales: number; revenue: number } {
  return { sales: s?.payment_count ?? 0, revenue: s?.total_sats ?? 0 };
}

/** The public share link for an item — what a creator posts anywhere. */
export function shareUrl(itemId: string): string {
  return `${LNBITS_URL()}/contentwall/${itemId}`;
}
