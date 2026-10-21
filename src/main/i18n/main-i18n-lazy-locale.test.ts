import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getLocale: vi.fn(() => 'en-US')
  }
}))

import { UI_LANGUAGE_ENGLISH, UI_LANGUAGE_SPANISH } from '../../shared/ui-language'
import {
  ensureMainI18n,
  setMainPluginLanguagePacks,
  setMainUiLanguage,
  translateMain
} from './main-i18n'
import { pluginLanguageResourceId } from '../../shared/plugins/plugin-language-pack-artifact'

describe('main-i18n locale loading', () => {
  beforeEach(async () => {
    await ensureMainI18n()
    setMainPluginLanguagePacks([])
    await setMainUiLanguage(UI_LANGUAGE_ENGLISH)
  })

  it('serves English synchronously from caller fallbacks', () => {
    expect(translateMain('missing.main.key', 'Fallback copy')).toBe('Fallback copy')
    expect(translateMain('menu.file', 'File')).toBe('File')
    expect(translateMain('menu.settings', 'Settings')).toBe('Settings')
  })

  it('resolves non-plugin languages to English', async () => {
    const locale = await setMainUiLanguage(UI_LANGUAGE_SPANISH)
    expect(locale).toBe('en')
    expect(translateMain('menu.file', 'File')).toBe('File')
    expect(translateMain('menu.settings', 'Settings')).toBe('Settings')
  })

  it('loads a contributed catalog for native menus and dialogs', async () => {
    const id = 'plugin:orca-samples.portuguese/pt-BR' as const
    setMainPluginLanguagePacks([
      {
        id,
        resourceLanguage: pluginLanguageResourceId(id),
        pluginKey: 'orca-samples.portuguese',
        locale: 'pt-BR',
        catalog: { menu: { file: 'Arquivo Orca' } }
      }
    ])

    await setMainUiLanguage(id)
    expect(translateMain('menu.file', 'File')).toBe('Arquivo Orca')

    setMainPluginLanguagePacks([])
    expect(await setMainUiLanguage(id)).toBe('en')
    expect(translateMain('menu.file', 'File')).toBe('File')
  })
})
