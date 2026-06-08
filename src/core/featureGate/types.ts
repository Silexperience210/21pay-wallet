// Feature gate contract. Consumed by Phase 2 (custodial) and Phase 5 (Casino)
// via isFeatureEnabled('casino') / isFeatureEnabled('custodial').

export type FeatureName = 'casino' | 'custodial';

export interface FeatureGate {
  casino: boolean;
  custodial: boolean;
  // The server may add fields later; unknown fields are ignored, and any
  // missing known field resolves to false (never undefined-truthy).
}

export const DEFAULT_GATE: FeatureGate = {
  casino: false,
  custodial: false,
};
