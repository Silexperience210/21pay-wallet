// Real NFC radio (react-native-nfc-manager). On modern Android, phone-to-phone NDEF
// push (Beam) is gone — so the supported flows are:
//   • SEND: read a Lightning tag/card (NDEF URI/Text) and pay the invoice it carries.
//   • RECEIVE/PROVISION: write a Lightning invoice/URI onto a programmable tag.
// (Phone-as-tag HCE is a further follow-up.)
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';

let started = false;
async function ensureStarted(): Promise<void> {
  if (!started) {
    await NfcManager.start();
    started = true;
  }
}

export async function isSupported(): Promise<boolean> {
  try {
    return await NfcManager.isSupported();
  } catch {
    return false;
  }
}

export async function isEnabled(): Promise<boolean> {
  try {
    await ensureStarted();
    return await NfcManager.isEnabled();
  } catch {
    return false;
  }
}

interface NdefRecordLike {
  type?: number[];
  payload?: number[];
}

function decodeNdef(tag: { ndefMessage?: NdefRecordLike[] } | null): string | null {
  const records = tag?.ndefMessage;
  if (!Array.isArray(records)) return null;
  for (const r of records) {
    if (!r?.payload) continue;
    try {
      const type = r.type ? String.fromCharCode(...r.type) : '';
      if (type === 'U') return Ndef.uri.decodePayload(r.payload as never);
      if (type === 'T') return Ndef.text.decodePayload(r.payload as never);
    } catch {
      /* try next record */
    }
  }
  return null;
}

/** SEND: open a reader session, return the decoded Lightning string from the tag. */
export async function readPaymentUri(): Promise<string> {
  await ensureStarted();
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    const decoded = decodeNdef(tag as { ndefMessage?: NdefRecordLike[] } | null);
    if (!decoded) throw new Error('No Lightning data found on the tag.');
    return decoded;
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

/** RECEIVE/PROVISION: write a Lightning URI (e.g. lightning:lnbc...) onto a writable tag. */
export async function writePaymentUri(uri: string): Promise<void> {
  await ensureStarted();
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const bytes = Ndef.encodeMessage([Ndef.uriRecord(uri)]);
    if (!bytes) throw new Error('Failed to encode the NDEF message.');
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

export async function cancel(): Promise<void> {
  await NfcManager.cancelTechnologyRequest().catch(() => {});
}
