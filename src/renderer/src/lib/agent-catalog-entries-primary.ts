import { getCatalogPlatform } from './agent-catalog-platform'
import openClaudeLogoUrl from '../../../../resources/openclaude-logo.png?url'
import { getTuiAgentLaunchCommand, TUI_AGENT_CONFIG } from '../../../shared/tui-agent-config'
import { translate } from '@/i18n/i18n'
import type { AgentCatalogEntry } from './agent-catalog'

/** Agents with first-class rate limit and quota metric support in Orca. */
export function primaryAgentCatalogEntries(): AgentCatalogEntry[] {
  return [
    {
      id: 'claude',
      label: translate('auto.lib.agent.catalog.0708ed89f1', 'Claude'),
      cmd: 'claude',
      homepageUrl: 'https://code.claude.com/docs'
    },
    {
      id: 'claude-agent-teams',
      label: translate('auto.lib.agent.catalog.bf53f09bf8', 'Claude Agent Teams'),
      cmd: getTuiAgentLaunchCommand(TUI_AGENT_CONFIG['claude-agent-teams'], getCatalogPlatform()),
      homepageUrl: 'https://code.claude.com/docs/en/agent-teams'
    },
    {
      id: 'openclaude',
      label: translate('auto.lib.agent.catalog.a5fc0cb622', 'OpenClaude'),
      cmd: 'openclaude',
      // Why: OpenClaude's published favicon has a padded 500px canvas; Orca
      // uses a cropped derivative of that official asset so 12px tab icons stay legible.
      iconUrl: openClaudeLogoUrl,
      homepageUrl: 'https://openclaude.gitlawb.com/'
    },
    {
      id: 'codex',
      label: translate('auto.lib.agent.catalog.760bc6883d', 'Codex'),
      cmd: 'codex',
      homepageUrl: 'https://github.com/openai/codex'
    },
    {
      id: 'cursor',
      label: translate('auto.lib.agent.catalog.667c104cff', 'Cursor'),
      cmd: 'cursor-agent',
      faviconDomain: 'cursor.com',
      homepageUrl: 'https://cursor.com/cli'
    },
    {
      id: 'gemini',
      label: translate('auto.lib.agent.catalog.12e6baa4f7', 'Gemini'),
      cmd: 'gemini',
      faviconDomain: 'gemini.google.com',
      homepageUrl: 'https://github.com/google-gemini/gemini-cli'
    },
    {
      id: 'antigravity',
      label: translate('auto.lib.agent.catalog.691dd11789', 'Antigravity'),
      cmd: 'agy',
      faviconDomain: 'antigravity.google',
      homepageUrl: 'https://antigravity.google/docs/cli-overview'
    },
    {
      id: 'grok',
      label: translate('auto.lib.agent.catalog.0baad2d5d2', 'Grok'),
      cmd: 'grok',
      faviconDomain: 'x.ai',
      homepageUrl: 'https://x.ai/cli'
    },
    {
      id: 'opencode2',
      label: translate('auto.lib.agent.catalog.opencode2_label', 'OpenCode 2'),
      cmd: 'opencode2',
      homepageUrl: 'https://opencode.ai/v2/docs/'
    },
    {
      id: 'opencode',
      label: translate('auto.lib.agent.catalog.e7a4ca5103', 'OpenCode'),
      cmd: 'opencode',
      homepageUrl: 'https://opencode.ai/docs/cli/'
    },
    {
      id: 'kimi',
      label: translate('auto.lib.agent.catalog.28810273af', 'Kimi'),
      cmd: 'kimi',
      faviconDomain: 'moonshot.cn',
      homepageUrl: 'https://www.kimi.com/code/docs/en/kimi-code-cli/getting-started.html'
    },
    {
      id: 'zcode',
      label: translate('auto.lib.agent.catalog.zcode_label', 'ZCode'),
      cmd: 'zcode',
      faviconDomain: 'zcode.z.ai',
      homepageUrl: 'https://zcode.z.ai/en/docs'
    }
  ]
}
