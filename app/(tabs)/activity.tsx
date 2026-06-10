import React, { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScreenScaffold, TxList, EmptyState } from '@/ui';
import { useWalletStore } from '@/core/state';
import { syncHistory } from '@/wallet';

export default function Activity(): React.ReactElement {
  const activeBackendKind = useWalletStore((s) => s.activeBackendKind);
  const txByBackend = useWalletStore((s) => s.txByBackend);
  const hydrateHistory = useWalletStore((s) => s.hydrateHistory);

  useFocusEffect(
    useCallback(() => {
      if (!activeBackendKind) return;
      hydrateHistory(activeBackendKind); // instant render from the local cache
      syncHistory()
        .then(() => hydrateHistory(activeBackendKind)) // then refresh from the backend
        .catch(() => {});
    }, [activeBackendKind, hydrateHistory]),
  );

  const txs = activeBackendKind ? (txByBackend[activeBackendKind] ?? []) : [];

  return (
    <ScreenScaffold title="Activity" scroll={txs.length > 0}>
      {txs.length === 0 ? (
        <EmptyState
          heading="No transactions yet"
          body="Receive your first sats to see them here."
        />
      ) : (
        <TxList txs={txs} />
      )}
    </ScreenScaffold>
  );
}
