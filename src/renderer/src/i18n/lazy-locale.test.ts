import { beforeEach, describe, expect, it } from 'vitest'

import { UI_LANGUAGE_ENGLISH, UI_LANGUAGE_SPANISH } from '../../../shared/ui-language'
import { i18n, setRendererPluginLanguagePacks, setRendererUiLanguage } from './i18n'
import { pluginLanguageResourceId } from '../../../shared/plugins/plugin-language-pack-artifact'

describe('renderer i18n lazy locale loading', () => {
  beforeEach(async () => {
    setRendererPluginLanguagePacks([])
    await i18n.changeLanguage('en')
  })

  it('serves English synchronously from the eager bundle', () => {
    expect(i18n.t('menu.file', { defaultValue: 'File' })).toBe('File')
  })

  it('resolves non-plugin languages to English', async () => {
    await setRendererUiLanguage(UI_LANGUAGE_SPANISH)
    expect(i18n.language).toBe('en')
    expect(i18n.t('menu.file', { defaultValue: 'File' })).toBe('File')

    await setRendererUiLanguage(UI_LANGUAGE_ENGLISH)
    expect(i18n.language).toBe('en')
    expect(i18n.t('menu.file', { defaultValue: 'File' })).toBe('File')
  })

  it('uses the inline English default when a catalog omits a key', async () => {
    expect(i18n.t('missing.renderer.feature', { defaultValue: 'English fallback' })).toBe(
      'English fallback'
    )
  })

  it('loads an isolated catalog contributed by an enabled plugin', async () => {
    const id = 'plugin:orca-samples.portuguese/pt-BR' as const
    setRendererPluginLanguagePacks([
      {
        id,
        resourceLanguage: pluginLanguageResourceId(id),
        pluginKey: 'orca-samples.portuguese',
        locale: 'pt-BR',
        catalog: { menu: { file: 'Arquivo Orca' } }
      }
    ])

    await setRendererUiLanguage(id)
    expect(i18n.language).toBe(pluginLanguageResourceId(id))
    expect(i18n.t('menu.file', { defaultValue: 'File' })).toBe('Arquivo Orca')

    setRendererPluginLanguagePacks([])
    await setRendererUiLanguage(id)
    expect(i18n.language).toBe('en')
  })
})
