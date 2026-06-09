// On-chain receive address as a Skia QR + copyable string. Thin wrapper over the
// same QR+CopyField pattern as InvoiceCard, fixed to the on-chain label.
import React from 'react';
import { InvoiceCard } from './InvoiceCard';

export function OnchainAddressCard({ address }: { address: string }): React.ReactElement {
  return <InvoiceCard data={address} kind="onchain" />;
}
