import { t, setLocale, getLocale } from './index';

describe('i18n', () => {
  afterEach(() => setLocale('fr')); // restore default

  it('defaults to French', () => {
    expect(getLocale()).toBe('fr');
    expect(t('home.send')).toBe('Envoyer');
  });

  it('switches to English', () => {
    setLocale('en');
    expect(t('home.send')).toBe('Send');
  });

  it('interpolates {placeholders}', () => {
    expect(t('balance.total', { amount: '5 sats' })).toBe('Total · 5 sats');
  });

  it('falls back to the key for an unknown string', () => {
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
});
