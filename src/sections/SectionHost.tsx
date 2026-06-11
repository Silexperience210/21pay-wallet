// Capability injector for sections — mirrors WalletProvider/useWallet. The host
// binds the active wallet's methods + the Core LNURL-auth signer into a scoped
// SectionCapabilities bundle; sections consume ONLY that bundle (constraint 5).
// Raw key material never crosses: signLnurlAuth loads the mnemonic inside Core,
// signs, zeroizes, and only { sig, key } reaches the section (SEC-04).
import React, { createContext, useContext, useMemo } from 'react';
import type { SectionCapabilities } from './capabilities';
import { useWallet } from '../wallet';
import { loadMnemonic } from '../core/keys';
import { signLnurlAuth } from '../core/keys/lnurlAuth';

const SectionCtx = createContext<SectionCapabilities | null>(null);

export function SectionHost({ children }: { children: React.ReactNode }): React.ReactElement {
  const wallet = useWallet(); // throws before onboarding — sections need an active wallet
  const capabilities = useMemo<SectionCapabilities>(
    () => ({
      wallet: {
        async payInvoice(bolt11: string) {
          const { preimage, feeSat } = await wallet.payInvoice(bolt11);
          return { preimage, feeSat }; // adapt: no paymentHash leak into the seam
        },
        async payLnAddress(addr: string, amountSat: number) {
          const { preimage } = await wallet.payLnAddress(addr, amountSat);
          return { preimage };
        },
        async createInvoice(amountSat: number, memo?: string) {
          const { bolt11 } = await wallet.createInvoice(amountSat, memo);
          return { bolt11 };
        },
      },
      signer: {
        async signLnurlAuth(k1Hex: string, domain: string) {
          // Mnemonic is loaded (biometric-gated) and consumed INSIDE Core; only
          // the LUD-04 { sig, key } result crosses into the section.
          const mnemonic = await loadMnemonic();
          return signLnurlAuth(mnemonic, k1Hex, domain);
        },
      },
    }),
    [wallet],
  );
  return <SectionCtx.Provider value={capabilities}>{children}</SectionCtx.Provider>;
}

/** The ONLY accessor sections use. Fail-fast outside a SectionHost (mirrors useWallet). */
export function useSectionCapabilities(): SectionCapabilities {
  const caps = useContext(SectionCtx);
  if (!caps) throw new Error('useSectionCapabilities must be called inside SectionHost');
  return caps;
}
