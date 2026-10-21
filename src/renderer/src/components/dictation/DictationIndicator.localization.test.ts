import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en.json'

const englishLabels = en.auto.components.dictation.DictationIndicator as Record<string, string>

describe('DictationIndicator localization', () => {
  it('uses generated localization keys', () => {
    expect(Object.keys(englishLabels).every((key) => /^[a-f0-9]{10}$/.test(key))).toBe(true)
  })
})
