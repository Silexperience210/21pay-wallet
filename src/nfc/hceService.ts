// HCE (Host Card Emulation) — the phone presents *itself* as an NFC Type 4 NDEF tag.
// This is the "phone-as-tag" follow-up that nfcService.ts deferred: instead of writing
// a Lightning invoice onto a physical programmable tag, we emulate a tag in software so a
// counterparty phone (reader mode, see readPaymentUri) or an NFC terminal can read the
// invoice/URI by tapping. Receiver-side only — the sender keeps using reader mode.
//
// Native side: react-native-hce registers `com.reactnativehce.services.CardService`
// (a HostApduService) bound by the OS on tap. Requires a custom dev/EAS build (not Expo
// Go) and a physical HCE-capable Android device. iOS has no HCE support — guarded below.
import { Platform } from 'react-native';
import {
  HCESession,
  NFCTagType4,
  NFCTagType4NDEFContentType,
} from 'react-native-hce';

let session: HCESession | null = null;
let removeReadListener: (() => void) | null = null;

/** HCE is Android-only (no Apple HCE API). */
export function isHceSupported(): boolean {
  return Platform.OS === 'android';
}

/**
 * Start emulating an NFC Type 4 tag that serves `uri` as an NDEF URI record.
 * Pass a full Lightning URI, e.g. `lightning:lnbc...` (invoice) or `lightning:lnurl...`.
 * `onRead` fires when a reader actually pulls the tag content — use it to advance the UI.
 * Returns once emulation is live; the OS keeps serving it even if the app backgrounds.
 */
export async function startEmulation(uri: string, onRead?: () => void): Promise<void> {
  if (!isHceSupported()) throw new Error('HCE is only available on Android.');
  // Tear down any previous emulation so we never serve a stale invoice.
  await stopEmulation();

  // URL content type → TNF_WELL_KNOWN / RTD_URI ('U') record, which readPaymentUri decodes.
  const tag = new NFCTagType4({
    type: NFCTagType4NDEFContentType.URL,
    content: uri,
    writable: false,
  });

  session = await HCESession.getInstance();
  session.setApplication(tag);
  if (onRead) {
    removeReadListener = session.on(HCESession.Events.HCE_STATE_READ, onRead);
  }
  await session.setEnabled(true);
}

/** Stop emulating and detach the read listener. Safe to call when nothing is running. */
export async function stopEmulation(): Promise<void> {
  try {
    if (removeReadListener) {
      removeReadListener();
      removeReadListener = null;
    }
    if (session) {
      await session.setEnabled(false);
    }
  } catch {
    /* idempotent teardown — ignore */
  } finally {
    session = null;
  }
}
