// Capability injector for sections — mirrors WalletProvider/useWallet. The host
// binds the active wallet's methods + the Core LNURL-auth signer into a scoped
// SectionCapabilities bundle; sections consume ONLY that bundle (constraint 5).
// Raw key material never crosses: signLnurlAuth loads the mnemonic inside Core,
// signs, zeroizes, and only { sig, key } reaches the section (SEC-04).
import React, { createContext, useContext, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { SectionCapabilities } from './capabilities';
import { useWallet } from '../wallet';
import { loadMnemonic, signNip98Auth, deriveNostrIdentity, signEvent } from '../core/keys';
import { loadNostrPrivkeyBytes } from '../core/keys/derivation';
import { signLnurlAuth } from '../core/keys/lnurlAuth';
import { getPref, setPref } from '../core/state';

// The ONLY kinds a section may have the identity sign (Hunch protocol write path:
// orders / disputes / reputation). Never extend casually — this list is the seam's
// blast-radius guard (no kind-0 metadata, no kind-4 DMs, no arbitrary notes).
const HUNCH_SIGNABLE_KINDS = new Set([38888, 30890, 30891]);

// Host-side namespace for the section store capability.
const STORE_NS = 'section.';
const SECRET_NS = 'section_'; // SecureStore keys: alphanumeric + ._- only

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
        // Capability-gated passthrough (MINE-04): present only when the active
        // backend implements it — sections feature-detect via optional chaining.
        ...(wallet.getOnchainAddress
          ? {
              async getOnchainAddress() {
                const { address } = await wallet.getOnchainAddress!();
                return { address };
              },
            }
          : {}),
      },
      signer: {
        async signLnurlAuth(k1Hex: string, domain: string) {
          // Mnemonic is loaded (biometric-gated) and consumed INSIDE Core; only
          // the LUD-04 { sig, key } result crosses into the section.
          const mnemonic = await loadMnemonic();
          return signLnurlAuth(mnemonic, k1Hex, domain);
        },
        async signNip98(opts: { url: string; method: string; challenge: string }) {
          // Same discipline: mnemonic consumed inside Core, only the SIGNED
          // (public) NIP-98 event crosses the seam (Phase 6 BitRent login).
          const mnemonic = await loadMnemonic();
          return signNip98Auth(mnemonic, opts);
        },
        async getNostrPubkey() {
          const mnemonic = await loadMnemonic();
          return deriveNostrIdentity(mnemonic).pubkeyHex; // PUBLIC identity only
        },
        async signHunchEvent(template: { kind: number; tags: string[][]; content: string }) {
          if (!HUNCH_SIGNABLE_KINDS.has(template.kind)) {
            throw new Error(`kind ${template.kind} is not section-signable`);
          }
          const mnemonic = await loadMnemonic();
          const ev = await signEvent(
            { ...template, created_at: Math.floor(Date.now() / 1000) },
            () => loadNostrPrivkeyBytes(mnemonic),
          );
          return {
            id: ev.id,
            pubkey: ev.pubkey,
            created_at: ev.created_at,
            kind: ev.kind,
            tags: ev.tags,
            content: ev.content,
            sig: ev.sig,
          };
        },
      },
      store: {
        async get(key: string) {
          try {
            return getPref(STORE_NS + key);
          } catch {
            return null;
          }
        },
        async set(key: string, value: string) {
          setPref(STORE_NS + key, value);
        },
        async getSecret(key: string) {
          return SecureStore.getItemAsync(SECRET_NS + key.replace(/[^A-Za-z0-9._-]/g, '_'));
        },
        async setSecret(key: string, value: string) {
          await SecureStore.setItemAsync(SECRET_NS + key.replace(/[^A-Za-z0-9._-]/g, '_'), value);
        },
        async deleteSecret(key: string) {
          await SecureStore.deleteItemAsync(SECRET_NS + key.replace(/[^A-Za-z0-9._-]/g, '_'));
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
