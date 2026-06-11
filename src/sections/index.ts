// Sections layer barrel — the reusable section pattern (pathfinder, Phase 5).
// Exposes the capability seam + host + boundary ONLY. Concrete Core internals
// (walletProvider, core/keys) are never re-exported here (constraint 5).
export type { SectionCapabilities } from './capabilities';
export { SectionHost, useSectionCapabilities } from './SectionHost';
export { SectionErrorBoundary } from './SectionErrorBoundary';
