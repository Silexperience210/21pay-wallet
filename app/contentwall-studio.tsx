// ContentWall Studio — the CREATOR side, powered by the custodial 21pay wallet's
// own LNbits keys (this is the same credential tier as the LN-address claim; no
// Core key material involved). v1 native scope: list my items + revenue stats +
// publish a paid ARTICLE + copy the share link. Images/bundles stay on the web UI.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { ScreenScaffold, PrimaryButton, SecondaryButton, EmptyState, theme } from '@/ui';
import { getActiveCustodialConfig } from '@/wallet';
import {
  listMyItems,
  createArticleItem,
  getItemStats,
  shareUrl,
  type ContentwallItem,
  type ItemStats,
} from '@/wallet/contentwall';
import { t } from '@/i18n';

export default function ContentwallStudio(): React.ReactElement {
  const cfg = getActiveCustodialConfig();
  const [items, setItems] = useState<ContentwallItem[]>([]);
  const [stats, setStats] = useState<Record<string, ItemStats | null>>({});
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('210');
  const [teaser, setTeaser] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!cfg) return;
    try {
      setErr(null);
      const list = await listMyItems(cfg).catch((e: unknown) => {
        // LNbits per-user extension gate: fresh accounts must ENABLE contentwall,
        // and this instance prices that activation (pay_to_enable) — explain it
        // instead of a generic "unreachable".
        if ((e as { status?: number })?.status === 403) {
          throw new Error('not-enabled');
        }
        throw e;
      });
      setItems(list);
      // Stats are best-effort decoration — fetch lazily, never block the list.
      for (const it of list.slice(0, 10)) {
        getItemStats(cfg, it.id).then((s) => setStats((prev) => ({ ...prev, [it.id]: s }))).catch(() => {});
      }
    } catch (e) {
      setErr(e instanceof Error && e.message === 'not-enabled' ? t('cw.notEnabled') : t('cw.backendErr'));
    }
  }, [cfg]);

  useEffect(() => {
    load();
  }, [load]);

  if (!cfg) {
    return (
      <ScreenScaffold title={t('cw.studio')}>
        <EmptyState heading={t('cw.needCustodial')} body={t('cw.needCustodialBody')} />
      </ScreenScaffold>
    );
  }

  const onPublish = async () => {
    setErr(null);
    setBusy(true);
    try {
      await createArticleItem(cfg, {
        title,
        amountSat: parseInt(price, 10) || 0,
        content,
        teaser: teaser || undefined,
        markdown: true,
      });
      setCreating(false);
      setTitle('');
      setContent('');
      setTeaser('');
      await load();
    } catch {
      setErr(t('cw.publishErr'));
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async (id: string) => {
    await Clipboard.setStringAsync(shareUrl(id)).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <ScreenScaffold title={t('cw.studio')} scroll>
      {err ? <Text style={styles.err}>{err}</Text> : null}

      {creating ? (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t('cw.form.title')}
            placeholderTextColor={theme.color.textMuted}
          />
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={(v) => setPrice(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder={t('cw.form.price')}
            placeholderTextColor={theme.color.textMuted}
          />
          <TextInput
            style={styles.input}
            value={teaser}
            onChangeText={setTeaser}
            placeholder={t('cw.form.teaser')}
            placeholderTextColor={theme.color.textMuted}
          />
          <TextInput
            style={[styles.input, styles.textarea]}
            value={content}
            onChangeText={setContent}
            placeholder={t('cw.form.content')}
            placeholderTextColor={theme.color.textMuted}
            multiline
            textAlignVertical="top"
          />
          <PrimaryButton label={t('cw.publish')} onPress={onPublish} loading={busy} />
          <SecondaryButton label={t('cw.cancel')} onPress={() => setCreating(false)} />
        </View>
      ) : (
        <PrimaryButton label={t('cw.newArticle')} onPress={() => setCreating(true)} />
      )}

      <Text style={styles.eyebrow}>{t('cw.myItems')}</Text>
      {items.length === 0 ? (
        <Text style={styles.hint}>{t('cw.noItems')}</Text>
      ) : (
        items.map((it) => {
          const s = stats[it.id];
          return (
            <View key={it.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{it.title}</Text>
                <Text style={styles.rowSub}>
                  {it.amount.toLocaleString('fr-FR')} sats · {it.content_type}
                  {s ? ` · ${t('cw.statsLine', { sales: String(s.sales ?? 0), revenue: String(s.revenue ?? 0) })}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => onCopy(it.id)} hitSlop={8} accessibilityRole="button">
                <Feather
                  name={copiedId === it.id ? 'check' : 'share-2'}
                  size={17}
                  color={copiedId === it.id ? theme.color.success : theme.color.accent}
                />
              </Pressable>
            </View>
          );
        })
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive, marginBottom: theme.space.sm, textAlign: 'center' },
  form: { gap: theme.space.md },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    fontFamily: theme.font.body.fontFamily,
    fontSize: 14,
    color: theme.color.text,
  },
  textarea: { minHeight: 160 },
  eyebrow: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.textMuted, marginTop: theme.space.xl, marginBottom: theme.space.sm },
  hint: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.textMuted, textAlign: 'center', marginTop: theme.space.md },
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
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: theme.font.label.fontFamily, fontSize: 14, color: theme.color.text },
  rowSub: { fontFamily: theme.font.body.fontFamily, fontSize: 12, color: theme.color.textMuted },
});
