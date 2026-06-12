// ContentWall Studio — the CREATOR side, powered by the custodial 21pay wallet's
// own LNbits keys (same credential tier as the LN-address claim; no Core key
// material). Publishes paid ARTICLES (markdown) and MEDIA: image / video / audio /
// file bundles — files are picked natively and pushed multipart to the extension
// (which validates real content by magic bytes server-side).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ScreenScaffold, PrimaryButton, SecondaryButton, EmptyState, theme } from '@/ui';
import { getActiveCustodialConfig } from '@/wallet';
import {
  listMyItems,
  createArticleItem,
  createMediaItem,
  uploadItemFile,
  getItemStats,
  shareUrl,
  type ContentwallItem,
  type ItemStats,
  type MediaContentType,
  type PickedFile,
} from '@/wallet/contentwall';
import { t } from '@/i18n';

type PublishType = 'article' | MediaContentType;

const TYPES: { key: PublishType; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'article', icon: 'file-text' },
  { key: 'image', icon: 'image' },
  { key: 'video', icon: 'video' },
  { key: 'audio', icon: 'music' },
  { key: 'bundle', icon: 'archive' },
];

export default function ContentwallStudio(): React.ReactElement {
  const cfg = getActiveCustodialConfig();
  const [items, setItems] = useState<ContentwallItem[]>([]);
  const [stats, setStats] = useState<Record<string, ItemStats | null>>({});
  const [creating, setCreating] = useState(false);
  const [pubType, setPubType] = useState<PublishType>('article');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('210');
  const [teaser, setTeaser] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
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

  const pickFiles = async () => {
    setErr(null);
    try {
      if (pubType === 'image' || pubType === 'video') {
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: pubType === 'image' ? ['images'] : ['videos'],
          quality: 0.92,
        });
        if (res.canceled || !res.assets?.[0]) return;
        const a = res.assets[0];
        setFiles([
          {
            uri: a.uri,
            name: a.fileName ?? `upload.${pubType === 'image' ? 'jpg' : 'mp4'}`,
            mimeType: a.mimeType ?? undefined,
          },
        ]);
      } else {
        // audio → single; bundle → multiple files of any type
        const res = await DocumentPicker.getDocumentAsync({
          multiple: pubType === 'bundle',
          type: pubType === 'audio' ? 'audio/*' : '*/*',
          copyToCacheDirectory: true,
        });
        if (res.canceled || !res.assets?.length) return;
        setFiles(
          res.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? undefined })),
        );
      }
    } catch {
      setErr(t('cw.pickErr'));
    }
  };

  const resetForm = () => {
    setCreating(false);
    setTitle('');
    setContent('');
    setTeaser('');
    setFiles([]);
    setProgress(null);
  };

  const onPublish = async () => {
    setErr(null);
    const amountSat = parseInt(price, 10) || 0;
    if (pubType !== 'article' && files.length === 0) {
      setErr(t('cw.needFile'));
      return;
    }
    setBusy(true);
    try {
      if (pubType === 'article') {
        await createArticleItem(cfg, {
          title,
          amountSat,
          content,
          teaser: teaser || undefined,
          markdown: true,
        });
      } else {
        const item = await createMediaItem(cfg, {
          title,
          amountSat,
          contentType: pubType,
          teaser: teaser || undefined,
        });
        for (let i = 0; i < files.length; i++) {
          setProgress(t('cw.uploading', { n: String(i + 1), total: String(files.length) }));
          await uploadItemFile(cfg, item.id, pubType, files[i]);
        }
      }
      resetForm();
      await load();
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : t('cw.publishErr'));
    } finally {
      setBusy(false);
      setProgress(null);
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
          <View style={styles.typeChips}>
            {TYPES.map(({ key, icon }) => (
              <Pressable
                key={key}
                onPress={() => {
                  setPubType(key);
                  setFiles([]);
                }}
                accessibilityRole="button"
                style={[styles.typeChip, pubType === key && styles.typeChipOn]}
              >
                <Feather name={icon} size={15} color={pubType === key ? theme.color.accent : theme.color.textMuted} />
                <Text style={[styles.typeChipText, pubType === key && styles.typeChipTextOn]}>
                  {t(`cw.type.${key}`)}
                </Text>
              </Pressable>
            ))}
          </View>

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

          {pubType === 'article' ? (
            <TextInput
              style={[styles.input, styles.textarea]}
              value={content}
              onChangeText={setContent}
              placeholder={t('cw.form.content')}
              placeholderTextColor={theme.color.textMuted}
              multiline
              textAlignVertical="top"
            />
          ) : (
            <>
              <SecondaryButton
                label={files.length > 0 ? t('cw.changeFile') : t(`cw.pick.${pubType}`)}
                onPress={pickFiles}
              />
              {files.map((f) => (
                <View key={f.uri} style={styles.fileRow}>
                  <Feather name="paperclip" size={13} color={theme.color.success} />
                  <Text style={styles.fileName} numberOfLines={1}>
                    {f.name}
                  </Text>
                </View>
              ))}
            </>
          )}

          {progress ? <Text style={styles.hint}>{progress}</Text> : null}
          <PrimaryButton label={t('cw.publish')} onPress={onPublish} loading={busy} />
          <SecondaryButton label={t('cw.cancel')} onPress={resetForm} />
        </View>
      ) : (
        <PrimaryButton label={t('cw.new')} onPress={() => setCreating(true)} />
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
  typeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  typeChipOn: { borderColor: theme.color.accent },
  typeChipText: { fontFamily: theme.font.label.fontFamily, fontSize: 12, color: theme.color.textMuted },
  typeChipTextOn: { color: theme.color.accent },
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
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, paddingHorizontal: theme.space.sm },
  fileName: { flex: 1, fontFamily: theme.font.mono.fontFamily, fontSize: 12, color: theme.color.text },
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
