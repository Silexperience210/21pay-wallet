import React, { useEffect } from 'react';
import { ScreenScaffold, TxList, EmptyState } from '@/ui';
import { useWalletStore } from '@/core/state';

export default function Activity(): React.ReactElement {
  const activeBackendKind = useWalletStore((s) => s.activeBackendKind);
  const txByBackend = useWalletStore((s) => s.txByBackend);
  const hydrateHistory = useWalletStore((s) => s.hydrateHistory);

  useEffect(() => {
    if (activeBackendKind) hydrateHistory(activeBackendKind);
  }, [activeBackendKind, hydrateHistory]);

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
