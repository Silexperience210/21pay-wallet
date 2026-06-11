// ContentWall — unlock paid content (buyer side). Paste a /contentwall link or
// item id → paywall card (title, price, teaser) → EXPLICIT pay CTA via the wallet
// → poll unlock → open the signed content URL. Purchases are remembered locally
// (payment_hash = the access proof, per the extension's own model) and re-opened
// via /me/purchases which mints a fresh signed URL.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenScaffold, PrimaryButton, SecondaryButton, theme } from '@/ui';
import { useWallet } from '@/wallet';
import {
  parseContentwallInput,
  getPublicItem,
  getPreview,
  createUnlockInvoice,
  pollUnlock,
  fetchPurchases,
  type PublicItem,
  type ItemPreview,
  type StoredPurchase,
} from '@/wallet/contentwall';
import { getPref, setPref } from '@/core/state';
import { t } from '@/i18n';

const PURCHASES_KEY = 'contentwall.purchases';

function loadStored(): StoredPurchase[] {
  try {
    const raw = getPref(PURCHASES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function ContentwallScreen(): React.ReactElement {
  const [input, setInput] = useState('');
  const [itemId, setItemId] = useState<string | null>(null);
  const [item, setItem] = useState<PublicItem | null>(null);
  const [preview, setPreview] = useState<ItemPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<StoredPurchase[]>([]);

  useEffect(() => {
    setPurchases(loadStored());
  }, []);

  const onLookup = async () => {
    setErr(null);
    setItem(null);
    setPreview(null);
    const id = parseContentwallInput(input);
    if (!id) {
      setErr(t('cw.invalidLink'));
      return;
    }
    setBusy(true);
    try {
      const [pub, prev] = await Promise.all([getPublicItem(id), getPreview(id)]);
      if (!pub && !prev) {
        setErr(t('cw.notFound'));
        return;
      }
      setItemId(id);
      setItem(pub);
      setPreview(prev);
    } catch {
      setErr(t('cw.backendErr'));
    } finally {
      setBusy(false);
    }
  };

  const onUnlock = async () => {
    if (!itemId) return;
    setErr(null);
    setPaying(true);
    try {
      // Amount omitted → the item's floor price (also the price-discovery path
      // when the deployed extension predates /public).
      const quote = await createUnlockInvoice(itemId);
      await useWallet().payInvoice(quote.payment_request); // EXPLICIT CTA — never auto
      const status = await pollUnlock(itemId, quote.payment_hash);
      if (!status.paid || !status.url) {
        setErr(t('cw.unlockSlow'));
        return;
      }
      const stored: StoredPurchase = {
        itemId,
        paymentHash: quote.payment_hash,
        title: item?.title ?? t('cw.untitled'),
        savedAt: Date.now(),
      };
      const next = [stored, ...purchases.filter((p) => p.paymentHash !== quote.payment_hash)];
      setPref(PURCHASES_KEY, JSON.stringify(next));
      setPurchases(next);
      router.push({ pathname: '/contentwall-view', params: { url: status.url, title: stored.title } });
    } catch {
      setErr(t('cw.payErr'));
    } finally {
      setPaying(false);
    }
  };

  const onOpenPurchase = async (p: StoredPurchase) => {
    setErr(null);
    try {
      // A fresh signed URL is minted server-side from the stored payment_hash.
      const found = await fetchPurchases([p.paymentHash]);
      const url = found[0]?.url;
      if (!url) {
        setErr(t('cw.purchaseGone'));
        return;
      }
      router.push({ pathname: '/contentwall-view', params: { url, title: p.title } });
    } catch {
      setErr(t('cw.backendErr'));
    }
  };

  return (
    <ScreenScaffold title={t('cw.title')} scroll>
      <Text style={styles.lead}>{t('cw.lead')}</Text>
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={setInput}
        placeholder="https://21pay.org/contentwall/…"
        placeholderTextColor={theme.color.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <SecondaryButton label={t('cw.lookup')} onPress={onLookup} />
      {busy ? <Text style={styles.hint}>{t('cw.loading')}</Text> : null}
      {err ? <Text style={styles.err}>{err}</Text> : null}

      {itemId && (item || preview) ? (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Feather name="lock" size={16} color={theme.color.accent} />
            <Text style={styles.cardTitle}>{item?.title ?? t('cw.untitled')}</Text>
          </View>
          {(item?.teaser_text ?? preview?.teaser_text) ? (
            <Text style={styles.teaser}>{item?.teaser_text ?? preview?.teaser_text}</Text>
          ) : null}
          <PrimaryButton
            label={
              item?.amount
                ? t('cw.unlockFor', { sats: item.amount.toLocaleString('fr-FR') })
                : t('cw.unlock')
            }
            onPress={onUnlock}
            loading={paying}
          />
        </View>
      ) : null}

      {purchases.length > 0 ? (
        <>
          <Text style={styles.eyebrow}>{t('cw.purchases')}</Text>
          {purchases.map((p) => (
            <Pressable key={p.paymentHash} onPress={() => onOpenPurchase(p)} accessibilityRole="button" style={styles.row}>
              <Feather name="unlock" size={15} color={theme.color.success} />
              <Text style={styles.rowTitle}>{p.title}</Text>
              <Feather name="chevron-right" size={16} color={theme.color.textMuted} />
            </Pressable>
          ))}
        </>
      ) : null}

      <View style={styles.studioRow}>
        <SecondaryButton label={t('cw.studio')} onPress={() => router.push('/contentwall-studio')} />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: theme.font.body.fontFamily, fontSize: 14, lineHeight: 20, color: theme.color.textMuted, marginBottom: theme.space.lg },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    fontFamily: theme.font.body.fontFamily,
    fontSize: 13,
    color: theme.color.text,
    marginBottom: theme.space.md,
  },
  hint: { fontFamily: theme.font.body.fontFamily, fontSize: 12, color: theme.color.textMuted, marginTop: theme.space.sm, textAlign: 'center' },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive, marginTop: theme.space.sm, textAlign: 'center' },
  card: {
    borderWidth: 1,
    borderColor: theme.color.accent,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    gap: theme.space.md,
    marginTop: theme.space.lg,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  cardTitle: { flex: 1, fontFamily: theme.font.label.fontFamily, fontSize: 15, color: theme.color.text },
  teaser: { fontFamily: theme.font.body.fontFamily, fontSize: 13, lineHeight: 18, color: theme.color.textMuted },
  eyebrow: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.textMuted, marginTop: theme.space.xl, marginBottom: theme.space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    marginBottom: theme.space.sm,
  },
  rowTitle: { flex: 1, fontFamily: theme.font.body.fontFamily, fontSize: 14, color: theme.color.text },
  studioRow: { marginTop: theme.space.xl },
});
