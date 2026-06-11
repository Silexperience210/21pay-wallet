// Feature gate contract. Consumed by Phase 2 (custodial), Phase 5 (Casino) and
// Phase 6 (Mineurs) via isFeatureEnabled('casino') / ('custodial') / ('mineurs').

export type FeatureName = 'casino' | 'custodial' | 'mineurs' | 'markets';

export interface FeatureGate {
  casino: boolean;
  custodial: boolean;
  mineurs: boolean;
  markets: boolean;
  // The server may add fields later; unknown fields are ignored, and any
  // missing known field resolves to false (never undefined-truthy).
}

export const DEFAULT_GATE: FeatureGate = {
  casino: false,
  custodial: false,
  mineurs: false,
  markets: false,
};
