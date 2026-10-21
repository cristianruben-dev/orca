import { UI_LANGUAGE_SYSTEM, isPluginUiLanguage, type UiLanguage } from './ui-language'

export const SUPPORTED_UI_LOCALES = ['en'] as const
export type SupportedUiLocale = (typeof SUPPORTED_UI_LOCALES)[number]

export const DEFAULT_UI_LOCALE: SupportedUiLocale = 'en'

export function normalizeSupportedUiLocale(_locale?: string): SupportedUiLocale {
  return DEFAULT_UI_LOCALE
}

export function resolveUiLocale(
  language: UiLanguage,
  _systemLocale: string | undefined = DEFAULT_UI_LOCALE
): string {
  if (isPluginUiLanguage(language)) {
    return language
  }
  return DEFAULT_UI_LOCALE
}

export function getRendererSystemLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language
  }
  return DEFAULT_UI_LOCALE
}

export function resolveRendererUiLocale(language: UiLanguage): string {
  return resolveUiLocale(
    language,
    language === UI_LANGUAGE_SYSTEM ? getRendererSystemLocale() : DEFAULT_UI_LOCALE
  )
}
