// RED stub — Wave-0 gap (Phase 5 / 05-01). Per-section React error boundary
// (CASINO-04 / D-08) — the heart of the section-isolation pathfinder. Filled
// GREEN in 05-02 against `@/sections/SectionErrorBoundary` (does not exist yet).
// No direct codebase analog (first React class boundary) — 05-02 renders with
// `react-test-renderer` (v19.1.0, available) per RESEARCH Validation Architecture.
//
// Run: `npx jest src/sections/SectionErrorBoundary.test.tsx`
//
// it.todo() (RED-by-design, suite stays green) until 05-02 implements the boundary
// and converts each todo to a real render assertion — same convention as the
// other Wave-0 stubs (spark.test.ts).

// ---------------------------------------------------------------------------
// CONTRACT the 05-02 implementation must satisfy (do NOT change these).
// ---------------------------------------------------------------------------
// import { SectionErrorBoundary } from '@/sections/SectionErrorBoundary';
//   - Wrap a <Thrower/> that throws during render -> boundary shows the fallback
//     (query for the fallback title / "Réessayer" retry control).
//   - A sibling rendered OUTSIDE the boundary stays mounted when the child throws
//     (isolation assertion — the heart of CASINO-04 / D-08).
//   - componentDidCatch does NOT rethrow (the host stays alive).
export const RETRY_LABEL = 'Réessayer';
export const FALLBACK_TITLE = 'Section indisponible';

describe('SectionErrorBoundary — render fallback + sibling isolation (CASINO-04) [RED stub, filled 05-02]', () => {
  it.todo('renders the fallback (title / "Réessayer" retry) when a child throws during render');
  it.todo('a sibling rendered OUTSIDE the boundary stays mounted when the child throws (isolation)');
  it.todo('componentDidCatch does not rethrow — the host tree stays alive');
});
