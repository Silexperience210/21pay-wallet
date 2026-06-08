import { MotiView } from 'moti';
import { StyleSheet, Text, View } from 'react-native';

// Phase 0 proof-of-life screen: a single Moti animated view confirming the
// dev client launches with the animation stack live. NO wallet logic, NO keys.
export default function Index() {
  return (
    <View style={styles.container}>
      <MotiView
        from={{ opacity: 0, scale: 0.8, translateY: 12 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 800 }}
        style={styles.badge}
      >
        <Text style={styles.text}>21pay</Text>
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: '#14141c',
  },
  text: {
    color: '#f7931a',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
