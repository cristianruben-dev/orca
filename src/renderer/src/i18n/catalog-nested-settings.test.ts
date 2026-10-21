import i18next from 'i18next'
import { expect, it } from 'vitest'
import { parsePluginLanguagePackArtifact } from '../../../shared/plugins/plugin-language-pack-artifact'
import en from './locales/en.json'

const AGENT_SETTINGS_KEYS = [
  'environmentName',
  'environmentValue',
  'savedEnvironment',
  'newEnvironment',
  'removeEnvironment',
  'loadingHost',
  'updateHost',
  'readFailed',
  'saveFailed',
  'hostDefaults',
  'save'
] as const

it.each([['en', en]] as const)(
  'keeps %s agent settings usable as nested language-pack translations',
  async (locale, catalog) => {
    // Bundled security copy is intentionally unavailable to plugin language packs.
    expect(
      parsePluginLanguagePackArtifact(JSON.stringify({ settings: catalog.settings }))
    ).toMatchObject({ ok: true })

    const instance = i18next.createInstance()
    await instance.init({
      lng: locale,
      fallbackLng: false,
      resources: { [locale]: { translation: catalog } },
      ignoreJSONStructure: false
    })
    for (const key of AGENT_SETTINGS_KEYS) {
      expect(instance.t(`settings.agents.${key}`, { name: 'PATH' })).toBe(
        catalog.settings.agents[key].replace('{{name}}', 'PATH')
      )
    }
    expect(instance.t('settings.appearance.chat.title')).toBe(
      catalog.settings.appearance.chat.title
    )
  }
)
