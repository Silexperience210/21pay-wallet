// Per-backend balance with a sats count-up. LN and on-chain are SEPARATE lines —
// never summed (ONBD-05). WALLET-06/07.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatSats } from '../wallet/format';
import { theme } from './theme';
import { useReducedMotion } from './useReducedMotion';

function useCountUp(target: number, reduced: boolean): number {
  const [val, setVal] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    if (reduced || prev.current === target) {
      setVal(target);
      prev.current = target;
      return;
    }
    const from = prev.current;
    const to = target;
    const start = Date.now();
    const dur = 700;
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setVal(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return val;
}

export function BalanceDisplay({
  lightningSat,
  onchainSat,
}: {
  lightningSat: number;
  onchainSat?: number;
}): React.ReactElement {
  const reduced = useReducedMotion();
  const shown = useCountUp(lightningSat, reduced);
  return (
    <View style={styles.wrap}>
      <Text style={styles.balance} accessibilityLabel={`Lightning balance ${lightningSat} sats`}>
        {formatSats(shown)}
      </Text>
      {onchainSat != null ? (
        <Text style={styles.onchain}>On-chain · {formatSats(onchainSat)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginVertical: theme.space.xl },
  balance: {
    fontFamily: theme.font.monoBalance.fontFamily,
    fontSize: theme.font.monoBalance.fontSize,
    color: theme.color.text,
  },
  onchain: {
    fontFamily: theme.font.mono.fontFamily,
    fontSize: 13,
    color: theme.color.textMuted,
    marginTop: theme.space.sm,
  },
});
