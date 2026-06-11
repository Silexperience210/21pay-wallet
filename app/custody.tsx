// Re-entrant Custody screen (D-07): the three sovereignty rungs with the active one
// highlighted, named NWC connections (switch / revoke / read-only node budget,
// IDENT-03/D-03/D-04), and the BLOCKING migration sheet on switch-away from a
// non-zero balance (D-06) — funds move only behind an explicit confirm, never
// silently, never automatically.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenScaffold, PrimaryButton, SecondaryButton, CustodyBadge, theme } from '@/ui';
import {
  useWallet,
  switchToCustodial,
  switchToNwc,
  switchToSelfHosted,
  sendAll,
  isSameNode,
  listConnections,
  deleteConnection,
  type NwcConnectionMeta,
  type NodeBudget,
  type WalletBackend,
} from '@/wallet';
import { useWalletStore } from '@/core/state';
import { t } from '@/i18n';

type Target = { kind: 'custodial' } | { kind: 'nwc'; id: string } | { kind: 'spark' };

/** Activate the requested target. Returns the new backend, or null when the target
 *  isn't provisioned yet (the caller routes into its connect/onboarding flow). */
async function activateTarget(target: Target): Promise<WalletBackend | null> {
  if (target.kind === 'custodial') return switchToCustodial();
  if (target.kind === 'nwc') return switchToNwc(target.id);
  return switchToSelfHosted();
}

export default function Custody(): React.ReactElement {
  const activeBackendKind = useWalletStore((s) => s.activeBackendKind);
  const [connections, setConnections] = useState<NwcConnectionMeta[]>([]);
  const [budget, setBudget] = useState<NodeBudget | null>(null);
  // Migration sheet state (D-06): a pending switch blocked on a non-zero balance.
  const [pending, setPending] = useState<{ target: Target; oldSats: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(() => {
    try {
      setConnections(listConnections());
    } catch {
      setConnections([]);
    }
  }, []);

  useEffect(() => {
    reload();
    // Read-only NODE-enforced budget (D-03) — display only, shown when the active
    // backend is NWC and the node supports get_budget.
    if (activeBackendKind === 'nwc') {
      try {
        const b = useWallet() as unknown as { readBudget?: () => Promise<NodeBudget | null> };
        b.readBudget?.().then(setBudget).catch(() => setBudget(null));
      } catch {
        setBudget(null);
      }
    } else {
      setBudget(null);
    }
  }, [activeBackendKind, reload]);

  /** Rung tap: gate the switch behind the migration sheet when funds are at stake. */
  const requestSwitch = async (target: Target) => {
    setErr(null);
    setNotice(null);
    if (
      (target.kind === 'custodial' && activeBackendKind === 'custodial-lnbits') ||
      (target.kind === 'spark' && activeBackendKind === 'self-hosted')
    ) {
      return; // already active
    }
    let oldSats = 0;
    try {
      oldSats = (await useWallet().getBalance()).lightningSat;
    } catch {
      oldSats = 0; // no active wallet / unreadable balance → nothing to strand
    }
    if (oldSats > 0) {
      setPending({ target, oldSats }); // BLOCKING sheet — never a silent strand (D-06)
      return;
    }
    await doSwitch(target);
  };

  /** Plain switch (zero balance, or the user explicitly chose not to move funds). */
  const doSwitch = async (target: Target) => {
    setBusy(true);
    try {
      const backend = await activateTarget(target);
      if (!backend) {
        // Target not provisioned yet → its connect flow.
        if (target.kind === 'spark') router.push('/spark-connect');
        else if (target.kind === 'custodial') router.push('/onboarding');
        else setErr(t('custody.switchErr'));
        return;
      }
      setPending(null);
      reload();
    } catch {
      setErr(t('custody.switchErr'));
    } finally {
      setBusy(false);
    }
  };

  /** Explicit-confirm "send all" (D-06): invoice on the NEW backend, paid from the
   *  OLD one, reconciled to terminal — then the switch completes. */
  const migrateAndSwitch = async () => {
    if (!pending) return;
    setBusy(true);
    setErr(null);
    try {
      const old = useWallet(); // still the active (source) backend
      const next = await activateTarget(pending.target);
      if (!next) {
        setErr(t('custody.switchErr'));
        return;
      }
      if (isSameNode(old, next)) {
        setNotice(t('custody.migrate.sameNode')); // pay-self guard (Pitfall 4b)
        setPending(null);
        return;
      }
      const { moved } = await sendAll(old, next);
      setNotice(t('custody.migrate.done', { sats: String(moved) }));
      setPending(null);
      reload();
    } catch {
      // Migration failed — funds are still on the old backend; the user can switch
      // back from this same screen. Nothing is stranded silently.
      setErr(t('custody.migrate.err'));
    } finally {
      setBusy(false);
    }
  };

  const onRevoke = async (id: string) => {
    try {
      await deleteConnection(id); // row + vault secret (D-04 / IDENT-03)
      reload();
    } catch {
      setErr(t('custody.switchErr'));
    }
  };

  const rung = (
    key: 'custodial' | 'nwc' | 'spark',
    active: boolean,
    onPress?: () => void,
  ) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress || busy}
      accessibilityRole="button"
      style={[styles.rung, active && styles.rungActive]}
    >
      <Text style={styles.rungTitle}>{t(`onboarding.${key}.title`)}</Text>
      {key === 'spark' ? <Text style={styles.expText}>{t('onboarding.experimental')}</Text> : null}
      {active ? <Text style={styles.activeTag}>{t('custody.active')}</Text> : null}
    </Pressable>
  );

  return (
    <ScreenScaffold title={t('custody.title')} scroll>
      <View style={styles.badgeRow}>
        <CustodyBadge />
      </View>

      {rung('custodial', activeBackendKind === 'custodial-lnbits', () => requestSwitch({ kind: 'custodial' }))}
      {rung('nwc', activeBackendKind === 'nwc')}
      {connections.map((c) => (
        <View key={c.id} style={[styles.connRow, c.isActive && activeBackendKind === 'nwc' && styles.rungActive]}>
          <Pressable
            style={styles.connMain}
            onPress={() => requestSwitch({ kind: 'nwc', id: c.id })}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={styles.connName}>{c.name}</Text>
            <Text style={styles.connSub}>{c.walletPubkey.slice(0, 12)}…</Text>
            {c.isActive && activeBackendKind === 'nwc' && budget ? (
              <Text style={styles.connSub}>
                {t('custody.budget', { used: String(budget.usedSat), total: String(budget.totalSat) })}
              </Text>
            ) : null}
          </Pressable>
          <Pressable onPress={() => onRevoke(c.id)} hitSlop={8} accessibilityRole="button">
            <Feather name="trash-2" size={18} color={theme.color.destructive} />
          </Pressable>
        </View>
      ))}
      <View style={styles.addRow}>
        <SecondaryButton label={t('custody.addNwc')} onPress={() => router.push('/nwc-connect')} />
      </View>
      {rung('spark', activeBackendKind === 'self-hosted', () => requestSwitch({ kind: 'spark' }))}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {err ? <Text style={styles.err}>{err}</Text> : null}

      {/* ── BLOCKING migration sheet (D-06) ── */}
      {pending ? (
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <Feather name="alert-triangle" size={22} color={theme.color.accent} />
            <Text style={styles.sheetTitle}>
              {t('custody.migrate.title', { sats: String(pending.oldSats) })}
            </Text>
            <Text style={styles.sheetBody}>{t('custody.migrate.body')}</Text>
            <PrimaryButton label={t('custody.migrate.cta')} onPress={migrateAndSwitch} loading={busy} />
            <SecondaryButton
              label={t('custody.migrate.skip')}
              onPress={() => {
                if (pending) doSwitch(pending.target);
              }}
            />
            <SecondaryButton label={t('custody.migrate.cancel')} onPress={() => setPending(null)} />
          </View>
        </View>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  badgeRow: { alignItems: 'flex-start', marginBottom: theme.space.lg },
  rung: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    marginBottom: theme.space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
  },
  rungActive: { borderColor: theme.color.accent },
  rungTitle: { flex: 1, fontFamily: theme.font.label.fontFamily, fontSize: 15, color: theme.color.text },
  activeTag: { fontFamily: theme.font.label.fontFamily, fontSize: 11, color: theme.color.accent },
  expText: { fontFamily: theme.font.label.fontFamily, fontSize: 10, color: theme.color.accent },
  connRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    marginBottom: theme.space.sm,
    marginLeft: theme.space.xl,
  },
  connMain: { flex: 1, gap: 2 },
  connName: { fontFamily: theme.font.label.fontFamily, fontSize: 14, color: theme.color.text },
  connSub: { fontFamily: theme.font.body.fontFamily, fontSize: 12, color: theme.color.textMuted },
  addRow: { marginLeft: theme.space.xl, marginBottom: theme.space.md },
  notice: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.success, marginTop: theme.space.md, textAlign: 'center' },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive, marginTop: theme.space.md, textAlign: 'center' },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.color.bg,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.space.xl,
    gap: theme.space.md,
    alignItems: 'stretch',
  },
  sheetTitle: { fontFamily: theme.font.label.fontFamily, fontSize: 16, color: theme.color.text },
  sheetBody: { fontFamily: theme.font.body.fontFamily, fontSize: 13, lineHeight: 19, color: theme.color.textMuted, marginBottom: theme.space.sm },
});
