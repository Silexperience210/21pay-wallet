// First-run sovereignty ladder (D-08 / ONBD-04): custody is an EXPLICIT up-front
// choice — custodial 21pay, bring-your-own-node NWC, or self-hosted Spark. This
// wizard is the ONLY path that reaches activateCustodial (the old Home one-tap entry
// routes here), so the two-onboarding-paths desync (Pitfall 6) cannot happen.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenScaffold, PrimaryButton, theme } from '@/ui';
import { createAndActivateCustodial } from '@/wallet';
import { t } from '@/i18n';

type Rung = 'custodial' | 'nwc' | 'spark' | 'ark';

const RUNG_ICONS: Record<Rung, keyof typeof Feather.glyphMap> = {
  custodial: 'zap',
  nwc: 'link',
  spark: 'shield',
  ark: 'anchor',
};

function RungCard({
  rung,
  selected,
  onSelect,
}: {
  rung: Rung;
  selected: boolean;
  onSelect: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      style={[styles.rung, selected && styles.rungSelected]}
    >
      <View style={styles.rungHead}>
        <Feather name={RUNG_ICONS[rung]} size={18} color={selected ? theme.color.accent : theme.color.textMuted} />
        <Text style={styles.rungTitle}>{t(`onboarding.${rung}.title`)}</Text>
        {rung === 'spark' || rung === 'ark' ? (
          <View style={styles.expBadge}>
            <Text style={styles.expBadgeText}>{t('onboarding.experimental')}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.rungBody}>{t(`onboarding.${rung}.body`)}</Text>
      <Text style={styles.rungTradeoff}>{t(`onboarding.${rung}.tradeoff`)}</Text>
    </Pressable>
  );
}

export default function Onboarding(): React.ReactElement {
  const [selected, setSelected] = useState<Rung>('custodial');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onContinue = async () => {
    setErr(null);
    if (selected === 'nwc') {
      router.push('/nwc-connect');
      return;
    }
    if (selected === 'spark') {
      router.push('/spark-connect');
      return;
    }
    if (selected === 'ark') {
      router.push('/ark-connect');
      return;
    }
    // Custodial rung — the EXISTING provisioning path, reused (D-08).
    setBusy(true);
    try {
      await createAndActivateCustodial();
      router.replace('/(tabs)');
    } catch {
      setErr(t('onboarding.err'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenScaffold title={t('onboarding.title')} scroll>
      <Text style={styles.lead}>{t('onboarding.lead')}</Text>
      <View style={styles.ladder}>
        <RungCard rung="custodial" selected={selected === 'custodial'} onSelect={() => setSelected('custodial')} />
        <RungCard rung="nwc" selected={selected === 'nwc'} onSelect={() => setSelected('nwc')} />
        <RungCard rung="spark" selected={selected === 'spark'} onSelect={() => setSelected('spark')} />
        <RungCard rung="ark" selected={selected === 'ark'} onSelect={() => setSelected('ark')} />
      </View>
      <PrimaryButton label={t(`onboarding.${selected}.cta`)} onPress={onContinue} loading={busy} />
      {err ? <Text style={styles.err}>{err}</Text> : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  lead: {
    fontFamily: theme.font.body.fontFamily,
    fontSize: 16,
    lineHeight: 22,
    color: theme.color.textMuted,
    marginBottom: theme.space.lg,
  },
  ladder: { gap: theme.space.md, marginBottom: theme.space.xl },
  rung: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    gap: theme.space.xs,
  },
  rungSelected: { borderColor: theme.color.accent },
  rungHead: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  rungTitle: { flex: 1, fontFamily: theme.font.label.fontFamily, fontSize: 15, color: theme.color.text },
  rungBody: { fontFamily: theme.font.body.fontFamily, fontSize: 13, lineHeight: 18, color: theme.color.textMuted },
  rungTradeoff: { fontFamily: theme.font.body.fontFamily, fontSize: 12, lineHeight: 16, color: theme.color.textMuted, fontStyle: 'italic' },
  expBadge: {
    borderWidth: 1,
    borderColor: theme.color.accent,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 2,
  },
  expBadgeText: { fontFamily: theme.font.label.fontFamily, fontSize: 10, color: theme.color.accent },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive, marginTop: theme.space.md, textAlign: 'center' },
});
