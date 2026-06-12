// Casino lobby — the hardened WebView host for the satoshi-casino21 game (D-01).
// Native owns auth/deposit/withdraw; the WebView only renders the game, carrying
// the session cookie so the embedded game sees the logged-in player (O-2).
//
// CASINO-04 — the three isolation layers:
//   layer 1 = SectionErrorBoundary wrapping the route group (05-02)
//   layer 2 = onRenderProcessGone → remount the WebView (here)
//   layer 3 = try/catch around every async bridge/wallet action (here — async
//             errors are NOT caught by React boundaries, RESEARCH Pitfall 2)
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, Href } from 'expo-router';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { ScreenScaffold, SecondaryButton, theme } from '@/ui';
import { t } from '@/i18n';
import { useSectionCapabilities } from '../SectionHost';
import { CASINO_ORIGIN_PATTERN, isCasinoOrigin } from './casinoConfig';
import { parseBridgeMessage, BRIDGE_JS } from './bridge';
import * as casinoApi from './casinoApi';
import { loginWithLnurlAuth } from './casinoAuth';

export interface ProvablyFairInfo {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

// Module-scoped PF state shared with the fair panel route (display-only, D-09).
let lastProvablyFair: ProvablyFairInfo | null = null;
export function getLastProvablyFair(): ProvablyFairInfo | null {
  return lastProvablyFair;
}

export function CasinoLobbyScreen(): React.ReactElement {
  const caps = useSectionCapabilities(); // NEVER useWallet (constraint 5)
  const [authed, setAuthed] = useState<boolean | null>(null); // null = logging in
  const [err, setErr] = useState<string | null>(null);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  // Remount key — layer 2: a dead renderer process gets a fresh WebView.
  const [webViewKey, setWebViewKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // layer 3: async login failures surface as state, never an unhandled throw
      const result = await loginWithLnurlAuth(caps);
      if (cancelled) return;
      setAuthed(result.ok);
      if (!result.ok) setErr(t('casino.backendErr'));
    })();
    return () => {
      cancelled = true;
    };
  }, [caps]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    const msg = parseBridgeMessage(event.nativeEvent.data);
    if (!msg) return; // hostile/unknown input — dropped (fail-closed)
    try {
      // layer 3: a throwing handler must never escape to the host
      switch (msg.type) {
        case 'balance_update':
          // Section-owned signal; update the lobby display but never the wallet store (D-04).
          setLiveBalance(msg.casinoBalanceSat);
          break;
        case 'provably_fair':
          lastProvablyFair = {
            serverSeedHash: msg.serverSeedHash,
            clientSeed: msg.clientSeed,
            nonce: msg.nonce,
          };
          break;
        case 'deposit_request':
          // NEVER auto-pay (T-05-16) — route to the explicit deposit screen,
          // pre-filling the amount the game asked for.
          {
            const params = msg.amountSat ? `?amountSat=${msg.amountSat}` : '';
            router.push(`/(sections)/casino/wallet${params}` as Href);
          }
          break;
      }
    } catch (e) {
      console.warn('[casino] bridge handler error:', (e as Error).message);
    }
  }, []);

  return (
    <ScreenScaffold title={t('casino.lobby.title')}>
      <View style={styles.headerRow}>
        <View style={styles.headerItem}>
          <SecondaryButton
            label={t('casino.wallet.title')}
            onPress={() => router.push('/(sections)/casino/wallet')}
          />
        </View>
        <View style={styles.headerItem}>
          <SecondaryButton
            label={t('casino.fair.title')}
            onPress={() => router.push('/(sections)/casino/fair')}
          />
        </View>
      </View>

      {liveBalance != null ? (
        <View style={styles.balanceChip}>
          <Text style={styles.balanceChipLabel}>{t('casino.balance')}</Text>
          <Text style={styles.balanceChipValue}>{liveBalance.toLocaleString('fr-FR')} sats</Text>
        </View>
      ) : null}

      {err ? <Text style={styles.err}>{err}</Text> : null}

      {authed === null ? (
        <Text style={styles.lead}>{t('casino.connecting')}</Text>
      ) : (
        <View style={styles.webviewWrap}>
          <WebView
            key={webViewKey}
            // Opaque source carrying the session cookie to the PINNED origin only.
            source={casinoApi.casinoWebViewSource()}
            // ── Hardening (T-05-14/15/20) ──
            originWhitelist={[CASINO_ORIGIN_PATTERN]}
            onShouldStartLoadWithRequest={(req) => isCasinoOrigin(req.url)}
            setSupportMultipleWindows={false}
            allowFileAccess={false}
            allowFileAccessFromFileURLs={false}
            allowsBackForwardNavigationGestures={false}
            allowUniversalAccessFromFileURLs={false}
            injectedJavaScriptBeforeContentLoaded={BRIDGE_JS}
            onMessage={handleMessage}
            // layer 2: native renderer death → remount, wallet untouched (T-05-17)
            onRenderProcessGone={() => {
              setWebViewKey((k) => k + 1);
              return true;
            }}
            onError={() => setErr(t('casino.backendErr'))}
            // onHttpError fires for EVERY subresource (favicon 404, in-page API
            // 401…) — only a failing main document means the casino is down.
            onHttpError={(e) => {
              const failed = e.nativeEvent.url?.replace(/\/+$/, '');
              const main = casinoApi.casinoWebViewSource().uri.replace(/\/+$/, '');
              if (failed === main) setErr(t('casino.backendErr'));
            }}
            style={styles.webview}
          />
        </View>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', gap: theme.space.md, marginBottom: theme.space.md },
  headerItem: { flex: 1 },
  balanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.color.cardFill,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    marginBottom: theme.space.md,
  },
  balanceChipLabel: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.textMuted },
  balanceChipValue: { fontFamily: theme.font.mono.fontFamily, fontSize: 14, color: theme.color.text },
  lead: { fontFamily: theme.font.body.fontFamily, fontSize: 15, color: theme.color.textMuted, textAlign: 'center', marginTop: theme.space.xl },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive, marginBottom: theme.space.sm },
  webviewWrap: { flex: 1, borderRadius: theme.radius.md, overflow: 'hidden', minHeight: 420 },
  webview: { flex: 1, backgroundColor: theme.color.bg },
});
