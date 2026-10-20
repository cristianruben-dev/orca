import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from './settings-search-keywords'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'

export const getIntegrationsPaneSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate(
      'auto.components.settings.integrations.search.f16e41cc72',
      'GitHub Integration'
    ),
    description: translate(
      'auto.components.settings.integrations.search.7166b9090c',
      'GitHub authentication via the gh CLI.'
    ),
    keywords: [
      ...translateSearchKeyword(
        'auto.components.settings.integrations.search.b79c21bd42',
        'github'
      ),
      ...translateSearchKeyword('auto.components.settings.integrations.search.41ccade05c', 'gh'),
      ...translateSearchKeyword(
        'auto.components.settings.integrations.search.c450244ad7',
        'integration'
      )
    ]
  },
  {
    title: translate(
      'auto.components.settings.integrations.search.b027b4b318',
      'Linear Integration'
    ),
    description: translate(
      'auto.components.settings.integrations.search.16a486a49d',
      'Connect Linear to browse and link issues.'
    ),
    keywords: [
      ...translateSearchKeyword(
        'auto.components.settings.integrations.search.7319e3015b',
        'linear'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.integrations.search.c450244ad7',
        'integration'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.integrations.search.faa0b5a0d9',
        'api key'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.integrations.search.3c3d3d8ffa',
        'connect'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.integrations.search.a626990bd2',
        'disconnect'
      )
    ]
  }
])
