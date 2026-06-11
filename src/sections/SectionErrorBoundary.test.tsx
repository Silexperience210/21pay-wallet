// Per-section React error boundary (CASINO-04 / D-08) — GREEN in 05-02.
// Renders with react-test-renderer per RESEARCH Validation Architecture.
//
// Run: `npx jest src/sections/SectionErrorBoundary.test.tsx`
import React from 'react';
import { Text, View } from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { SectionErrorBoundary } from './SectionErrorBoundary';

// ---------------------------------------------------------------------------
// CONTRACT (from the 05-01 RED stub — unchanged).
// ---------------------------------------------------------------------------
export const RETRY_LABEL = 'Réessayer';
export const FALLBACK_TITLE = 'Section indisponible';

function Thrower(): React.ReactElement {
  throw new Error('boom — section render crash');
}

function textsOf(tree: ReactTestRenderer): string[] {
  return tree.root.findAllByType(Text).map((t) => String(t.props.children));
}

// React logs caught boundary errors to console.error — silence for clean output.
let consoleError: jest.SpyInstance;
let consoleWarn: jest.SpyInstance;
beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  consoleError.mockRestore();
  consoleWarn.mockRestore();
});

describe('SectionErrorBoundary — render fallback + sibling isolation (CASINO-04)', () => {
  it('renders the fallback (title / "Réessayer" retry) when a child throws during render', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <SectionErrorBoundary>
          <Thrower />
        </SectionErrorBoundary>,
      );
    });
    const texts = textsOf(tree);
    expect(texts).toContain(FALLBACK_TITLE);
    expect(texts).toContain(RETRY_LABEL);
    expect(texts).toContain("Le portefeuille n'est pas affecté.");
  });

  it('a sibling rendered OUTSIDE the boundary stays mounted when the child throws (isolation)', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <View>
          <Text>wallet-sibling-alive</Text>
          <SectionErrorBoundary>
            <Thrower />
          </SectionErrorBoundary>
        </View>,
      );
    });
    const texts = textsOf(tree);
    expect(texts).toContain('wallet-sibling-alive'); // the wallet tab is untouched
    expect(texts).toContain(FALLBACK_TITLE); // while the section shows its fallback
  });

  it('componentDidCatch does not rethrow — the host tree stays alive', () => {
    expect(() => {
      act(() => {
        renderer.create(
          <SectionErrorBoundary fallbackTitle="Casino indisponible">
            <Thrower />
          </SectionErrorBoundary>,
        );
      });
    }).not.toThrow();
    // componentDidCatch logged (message only — never key material).
    expect(consoleWarn).toHaveBeenCalled();
    const [firstArg] = consoleWarn.mock.calls[0];
    expect(String(firstArg)).toContain('render error');
  });
});
