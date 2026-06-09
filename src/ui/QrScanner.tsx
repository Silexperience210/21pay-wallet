// Unified QR scanner. Requests camera permission explicitly; degrades to a graceful
// EmptyState + Settings link when denied (never a dead screen). On a scan it calls
// parsePaymentInput ONCE and hands the classification up — it NEVER pays.
import React, { useRef, useState } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { MotiView } from 'moti';
import { parsePaymentInput, type ParsedPayment } from '@/wallet/parse';
import { t } from '@/i18n';
import { theme } from './theme';
import { EmptyState } from './EmptyState';
import { SecondaryButton } from './SecondaryButton';
import { useReducedMotion } from './useReducedMotion';

export function QrScanner({ onDecode }: { onDecode: (parsed: ParsedPayment) => void }): React.ReactElement {
  const reduced = useReducedMotion();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const armed = useRef(true);

  // Undetermined → ask explicitly the first time.
  if (!permission) {
    return <View style={styles.fill} />;
  }
  if (!permission.granted) {
    return (
      <View style={styles.denied}>
        <EmptyState heading={t('scan.camOff')} body={t('scan.camBody')} />
        {permission.canAskAgain ? (
          <SecondaryButton label={t('scan.allow')} onPress={requestPermission} />
        ) : (
          <SecondaryButton label={t('scan.openSettings')} onPress={() => Linking.openSettings()} />
        )}
      </View>
    );
  }

  const handleScan = ({ data }: { data: string }) => {
    if (!armed.current) return;
    armed.current = false; // decode once, then disable to guard double-fire
    const parsed = parsePaymentInput(data);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onDecode(parsed);
    // Re-arm shortly so an "unknown" code can be retried without remounting.
    setTimeout(() => {
      armed.current = true;
    }, 1200);
  };

  return (
    <View style={styles.fill}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleScan}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <MotiView
          from={{ opacity: reduced ? 1 : 0.5 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 900, loop: !reduced }}
          style={styles.viewfinder}
        />
        <View style={styles.torchRow}>
          <SecondaryButton label={torch ? t('scan.torchOff') : t('scan.torchOn')} onPress={() => setTorch((v) => !v)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.color.bg },
  denied: { flex: 1, justifyContent: 'center', paddingHorizontal: theme.space.xl, gap: theme.space.lg },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  viewfinder: {
    width: 240,
    height: 240,
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    borderColor: theme.color.accent,
  },
  torchRow: { position: 'absolute', bottom: theme.space['3xl'] },
});
