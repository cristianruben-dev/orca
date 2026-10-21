import { describe, expect, it } from 'vitest'

import { normalizeSupportedUiLocale, resolveUiLocale } from './ui-locale'
import {
  UI_LANGUAGE_CHINESE,
  UI_LANGUAGE_ENGLISH,
  UI_LANGUAGE_FRENCH,
  UI_LANGUAGE_JAPANESE,
  UI_LANGUAGE_KOREAN,
  UI_LANGUAGE_SPANISH,
  UI_LANGUAGE_SYSTEM
} from './ui-language'

describe('ui-locale', () => {
  it('normalizes locales to English', () => {
    expect(normalizeSupportedUiLocale('en-US')).toBe('en')
    expect(normalizeSupportedUiLocale('zh-CN')).toBe('en')
    expect(normalizeSupportedUiLocale('de-DE')).toBe('en')
  })

  it('resolves explicit languages to English', () => {
    expect(resolveUiLocale(UI_LANGUAGE_ENGLISH, 'zh-CN')).toBe('en')
    expect(resolveUiLocale(UI_LANGUAGE_CHINESE, 'en-US')).toBe('en')
    expect(resolveUiLocale(UI_LANGUAGE_KOREAN, 'en-US')).toBe('en')
    expect(resolveUiLocale(UI_LANGUAGE_JAPANESE, 'en-US')).toBe('en')
    expect(resolveUiLocale(UI_LANGUAGE_SPANISH, 'en-US')).toBe('en')
    expect(resolveUiLocale(UI_LANGUAGE_FRENCH, 'en-US')).toBe('en')
  })

  it('preserves a selected plugin language bundle id', () => {
    expect(resolveUiLocale('plugin:orca-samples.portuguese/pt-BR')).toBe(
      'plugin:orca-samples.portuguese/pt-BR'
    )
  })

  it('maps system locale to English', () => {
    expect(resolveUiLocale(UI_LANGUAGE_SYSTEM, 'en-GB')).toBe('en')
    expect(resolveUiLocale(UI_LANGUAGE_SYSTEM, 'zh-CN')).toBe('en')
    expect(resolveUiLocale(UI_LANGUAGE_SYSTEM, 'ko-KR')).toBe('en')
    expect(resolveUiLocale(UI_LANGUAGE_SYSTEM, 'ja-JP')).toBe('en')
    expect(resolveUiLocale(UI_LANGUAGE_SYSTEM, 'es-MX')).toBe('en')
    expect(resolveUiLocale(UI_LANGUAGE_SYSTEM, 'fr-FR')).toBe('en')
  })
})
