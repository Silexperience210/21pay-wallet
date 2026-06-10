// Backup screen — SEC-05/SEC-06. Reveals the recovery phrase behind an explicit
// tap, blocks screen capture while mounted (guardSecretScreen), then gates the
// "backed up" pref behind the word-verification quiz from core/keys/backup.
// The seed is never copied to the clipboard and never logged.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenScaffold, PrimaryButton, SecondaryButton, theme } from '@/ui';
import {
  loadMnemonic,
  guardSecretScreen,
  releaseSecretScreen,
  buildQuiz,
  checkQuiz,
} from '@/core/keys';
import type { QuizChallenge } from '@/core/keys/backup';
import { setPref } from '@/core/state';
import { ensureMasterKey } from '@/wallet';
import { t } from '@/i18n';

type Step = 'hidden' | 'revealed' | 'quiz' | 'done';

export default function BackupScreen(): React.ReactElement {
  const [step, setStep] = useState<Step>('hidden');
  const [words, setWords] = useState<string[]>([]);
  const [quiz, setQuiz] = useState<QuizChallenge[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    guardSecretScreen().catch(() => {});
    return () => {
      releaseSecretScreen().catch(() => {});
    };
  }, []);

  const reveal = async () => {
    setErr(null);
    try {
      await ensureMasterKey(); // heals installs onboarded before key generation was wired
      const mnemonic = await loadMnemonic(); // keystore/biometric-gated in the vault
      setWords(mnemonic.trim().split(/\s+/));
      setStep('revealed');
    } catch {
      setErr(t('backup.loadErr'));
    }
  };

  const startQuiz = () => {
    setAnswers({});
    setErr(null);
    setQuiz(buildQuiz(words.join(' '), 3));
    setStep('quiz');
  };

  const submitQuiz = () => {
    const ok = checkQuiz(
      words.join(' '),
      quiz.map((q) => ({ index: q.index, word: answers[q.index] ?? '' })),
    );
    if (!ok) {
      setErr(t('backup.quizErr'));
      return;
    }
    try {
      setPref('backupConfirmed', '1');
    } catch {
      /* best-effort */
    }
    setWords([]); // drop the secret from JS state as soon as it is no longer needed
    setStep('done');
  };

  return (
    <ScreenScaffold title={t('backup.title')}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={styles.close}
      >
        <Feather name="chevron-left" size={26} color={theme.color.text} />
      </Pressable>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 'hidden' && (
          <>
            <Text style={styles.hint}>{t('backup.revealHint')}</Text>
            <PrimaryButton label={t('backup.reveal')} onPress={reveal} />
          </>
        )}

        {step === 'revealed' && (
          <>
            <View style={styles.grid}>
              {words.map((w, i) => (
                <View key={i} style={styles.wordChip}>
                  <Text style={styles.wordIndex}>{i + 1}</Text>
                  <Text style={styles.word}>{w}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.hint}>{t('backup.writeHint')}</Text>
            <PrimaryButton label={t('backup.startQuiz')} onPress={startQuiz} />
          </>
        )}

        {step === 'quiz' && (
          <>
            <Text style={styles.hint}>{t('backup.quizHint')}</Text>
            {quiz.map((q) => (
              <View key={q.index} style={styles.quizRow}>
                <Text style={styles.quizLabel}>
                  {t('backup.wordN').replace('{n}', String(q.index + 1))}
                </Text>
                <TextInput
                  style={styles.quizInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  value={answers[q.index] ?? ''}
                  onChangeText={(v) => setAnswers((a) => ({ ...a, [q.index]: v }))}
                />
              </View>
            ))}
            <PrimaryButton label={t('backup.confirm')} onPress={submitQuiz} />
            <SecondaryButton label={t('backup.showAgain')} onPress={() => setStep('revealed')} />
          </>
        )}

        {step === 'done' && (
          <>
            <Text style={styles.doneTitle}>{t('backup.doneTitle')}</Text>
            <Text style={styles.hint}>{t('backup.doneBody')}</Text>
            <PrimaryButton label={t('backup.close')} onPress={() => router.back()} />
          </>
        )}

        {err && <Text style={styles.err}>{err}</Text>}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  close: { marginBottom: theme.space.md, alignSelf: 'flex-start' },
  body: { gap: theme.space.lg, paddingBottom: theme.space.xl },
  hint: {
    fontFamily: theme.font.body.fontFamily,
    fontSize: 14,
    color: theme.color.textMuted,
    lineHeight: 20,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm },
  wordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    minWidth: '30%',
  },
  wordIndex: { fontFamily: theme.font.label.fontFamily, fontSize: 11, color: theme.color.accent },
  word: { fontFamily: theme.font.mono.fontFamily, fontSize: 14, color: theme.color.text },
  quizRow: { gap: theme.space.xs },
  quizLabel: { fontFamily: theme.font.label.fontFamily, fontSize: 13, color: theme.color.text },
  quizInput: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    fontFamily: theme.font.mono.fontFamily,
    fontSize: 15,
    color: theme.color.text,
  },
  doneTitle: { fontFamily: theme.font.label.fontFamily, fontSize: 18, color: theme.color.text },
  err: { fontFamily: theme.font.body.fontFamily, fontSize: 13, color: theme.color.destructive },
});
