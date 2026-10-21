import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n, translate } from '@/i18n/i18n'
import type * as I18nModule from '@/i18n/i18n'
import en from '@/i18n/locales/en.json'
import {
  AGENT_SESSION_ATTACHMENT_PROBLEM_REASONS,
  AGENT_SESSION_FAILURE_KINDS,
  readWholeAgentSessionFailureFact,
  type AgentSessionFailureFact
} from '../../../../shared/agent-session-failure'
import {
  AGENT_SESSION_FAILURE_COPY,
  sayAgentSessionFailureEnglish,
  type AgentSessionFailureCopyId
} from '../../../../shared/agent-session-failure-copy'
import {
  agentSessionFailureSentence,
  type AgentSessionFailureWordsContext
} from '../../../../shared/agent-session-failure-words'
import { AGENT_SESSION_WRITE_NOTICE_COPY } from '../../../../shared/agent-session-write-notice-copy'
import { agentSessionWriteNoticeParts } from '../../../../shared/agent-session-refusal-notice'
import { agentSessionRefusalFailure } from '../../../../shared/agent-session-write-failure'
import { structuredAgentSessionRejectionParts } from '../../../../shared/structured-agent-session-rejection-words'
import { sayAgentSessionFailureTranslated } from './agent-session-failure-words-text'
import { agentSessionWriteNoticeText } from './agent-session-write-notice-text'

vi.mock('@/i18n/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof I18nModule>()
  return { ...actual, translate: vi.fn(actual.translate) }
})

const IDS = Object.keys(AGENT_SESSION_FAILURE_COPY).filter(
  (id): id is AgentSessionFailureCopyId => id in AGENT_SESSION_FAILURE_COPY
)
// Said by a refusal notice too, so they keep the notice's keys.
const NOTICE_PIECES: readonly AgentSessionFailureCopyId[] = [
  'terminalAgentHoldsChat',
  'quitTerminalAgent',
  'startNewChat',
  'backgroundTasksRunning',
  'waitForBackgroundTasks',
  'agentStarting',
  'waitForStart',
  'agentStillWorking'
]
const VALUES = {
  agent: 'Claude',
  loginCommand: 'agent login',
  slashCommand: '/login',
  command: 'compact',
  detail: 'Image type .bmp',
  limit: '20',
  size: '5',
  option: '--remote'
}

function factsFor(kind: AgentSessionFailureFact['kind']): AgentSessionFailureFact[] {
  const facts: AgentSessionFailureFact[] = [
    { kind },
    { kind, detail: { text: 'Context window exceeded.', audience: 'person' } },
    { kind, detail: { text: 'exit 1', audience: 'log' } },
    // Person words with nothing left once trimmed: the sentence says the lead alone.
    { kind, detail: { text: ' ... ', audience: 'person' } },
    { kind, refusal: { code: 'agent_session_conflict', details: { reason: 'claimConflicted' } } },
    { kind, refusal: { code: 'structured_agent_session_unsupported' } },
    { kind, retry: { error: 'rate_limit', status: 429 } }
  ]
  for (const reason of AGENT_SESSION_ATTACHMENT_PROBLEM_REASONS) {
    facts.push({ kind, attachment: { reason } }, { kind, attachment: { reason, limit: 20 } })
  }
  return facts
}

const CONTEXTS: AgentSessionFailureWordsContext[] = [
  {},
  { agentName: 'Codex' },
  { agentName: 'Claude', command: 'clear' },
  { retryControl: true },
  { agentName: 'Claude', command: 'clear', retryControl: true },
  { agentName: 'Codex', command: 'compact' },
  { command: 'compact', retryControl: true }
]

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('desktop words for a failure fact', () => {
  it('keeps English copy while separating an unpunctuated provider detail', async () => {
    await i18n.changeLanguage('en')
    const fact = {
      kind: 'notSignedIn',
      detail: { text: 'See {{agent}} docs/models.md', audience: 'person' }
    } as const
    const context = { agentName: 'Pi' }
    const row = agentSessionFailureSentence(fact, 'row', context, sayAgentSessionFailureTranslated)
    expect(row.endsWith(fact.detail.text)).toBe(true)
    expect(
      agentSessionFailureSentence(fact, 'rejection', context, sayAgentSessionFailureTranslated)
    ).toBe(`${row}. Then send your message again.`)
  })

  it('has a key for every piece, whose English default is the shared sentence', () => {
    for (const id of IDS) {
      expect([id, sayAgentSessionFailureTranslated(id, VALUES)]).toEqual([
        id,
        sayAgentSessionFailureEnglish(id, VALUES)
      ])
    }
  })

  // The catalog answers first in English, so read the default each key is given directly.
  it('gives each key the shared sentence as its English default', () => {
    for (const id of IDS) {
      vi.mocked(translate).mockClear()
      sayAgentSessionFailureTranslated(id, VALUES)
      const section = NOTICE_PIECES.includes(id) ? 'writeNotice' : 'failureWords'
      expect(vi.mocked(translate).mock.calls.map(([key, fallback]) => [key, fallback])).toEqual([
        [`components.native-chat.${section}.${id}`, AGENT_SESSION_FAILURE_COPY[id]]
      ])
    }
  })

  it('keeps the English catalog in step with the shared copy', () => {
    const own = Object.fromEntries(
      IDS.filter((id) => !NOTICE_PIECES.includes(id)).map((id) => [
        id,
        AGENT_SESSION_FAILURE_COPY[id]
      ])
    )
    expect(en.components['native-chat'].failureWords).toEqual(own)
    for (const id of NOTICE_PIECES) {
      expect(AGENT_SESSION_WRITE_NOTICE_COPY).toHaveProperty(id, AGENT_SESSION_FAILURE_COPY[id])
    }
  })

  it('says every sentence exactly as the host writes it, in English', () => {
    for (const kind of AGENT_SESSION_FAILURE_KINDS) {
      for (const fact of factsFor(kind)) {
        for (const surface of ['row', 'rejection'] as const) {
          for (const context of CONTEXTS) {
            expect(
              agentSessionFailureSentence(fact, surface, context, sayAgentSessionFailureTranslated)
            ).toBe(agentSessionFailureSentence(fact, surface, context))
          }
        }
      }
    }
  })

  it('words a refused start and a rejected message in English', () => {
    const refused = agentSessionRefusalFailure({
      code: 'agent_session_operation_invalid',
      details: { reason: 'notSignedIn' }
    })
    expect(
      agentSessionWriteNoticeText(
        agentSessionWriteNoticeParts(refused, 'send', { agentName: 'Claude' })
      )
    ).toBe(
      "Your message was not sent. Claude isn't signed in. Run `claude auth login`, or choose an account in Claude Accounts settings."
    )
    const detail = 'Uses {{agent}} $t(components.native-chat.failureWords.theAgent) <b>&</b>'
    const rejected = structuredAgentSessionRejectionParts(
      `Codex didn't accept this message: ${detail}.`,
      'send',
      { kind: 'providerRejected', detail: { text: detail, audience: 'person' } },
      { agentName: 'Codex' }
    )
    // The provider's own words stay as written: placeholders, nesting and markup are not read.
    expect(agentSessionWriteNoticeText(rejected)).toBe(
      `Codex didn't accept this message: ${detail}.`
    )
    expect(
      agentSessionWriteNoticeText(
        structuredAgentSessionRejectionParts(null, 'send', { kind: 'providerExited' }, {})
      )
    ).toBe('The agent stopped before this message was sent.')
  })

  it('names the command a failed start was for inside the sentence', () => {
    const sentence = (kind: AgentSessionFailureFact['kind'], command: 'clear' | 'compact') =>
      agentSessionFailureSentence(
        { kind },
        'row',
        { agentName: 'Codex', command },
        sayAgentSessionFailureTranslated
      )
    expect(sentence('restartFailed', 'compact')).toBe("Codex couldn't restart. Run /compact again.")
    expect(sentence('notSignedIn', 'clear')).toBe(
      "Codex isn't signed in. Run `codex login`. Run /clear again."
    )
    expect(sentence('providerStartFailed', 'compact')).toBe(
      'Codex stopped before it finished starting. Run /compact again.'
    )
  })

  it('says which request a start ran out of time on', () => {
    expect(
      agentSessionFailureSentence(
        { kind: 'startFailed', requestTimeout: { method: 'thread/start', timeoutMs: 30_000 } },
        'row',
        { agentName: 'Codex', retryControl: true },
        sayAgentSessionFailureTranslated
      )
    ).toBe(
      'Codex took too long to start (no response to thread/start after 30s). If this keeps happening, the computer running this chat may be overloaded.'
    )
  })

  it('says a refused command and a refused Stop', () => {
    const sentence = (fact: AgentSessionFailureFact) =>
      agentSessionFailureSentence(
        fact,
        'row',
        { agentName: 'Codex' },
        sayAgentSessionFailureTranslated
      )
    expect(sentence({ kind: 'commandRefused' })).toBe("This command didn't run. Try it again.")
    expect(sentence({ kind: 'stopRefused' })).toBe('Codex had no turn running to stop.')
    expect(
      sentence({
        kind: 'stopRefused',
        detail: { text: 'no active turn to interrupt.', audience: 'person' }
      })
    ).toBe("Codex didn't stop: no active turn to interrupt.")
  })

  it("says an image's size limit", () => {
    const sentence = (reason: 'tooLarge' | 'totalTooLarge', megabytes: number) =>
      agentSessionFailureSentence(
        { kind: 'attachmentInvalid', attachment: { reason, limit: megabytes * 1024 * 1024 } },
        'rejection',
        {},
        sayAgentSessionFailureTranslated
      )
    expect(sentence('tooLarge', 5)).toBe(
      'An image on this message is larger than 5 MB, so the message was not sent.'
    )
    expect(sentence('totalTooLarge', 20)).toBe(
      'The images on this message add up to more than 20 MB, so the message was not sent.'
    )
  })

  it('uses the host sentence if the argument detail is newer than this reader', () => {
    const sentence = 'Codex could not start. Edit saved Arguments in Settings > Agents.'
    expect(
      agentSessionWriteNoticeText(
        structuredAgentSessionRejectionParts(
          sentence,
          'send',
          readWholeAgentSessionFailureFact({
            kind: 'startFailed',
            argumentProblem: { agent: 'Codex', option: '--remote', problem: 'futureProblem' }
          })
        )
      )
    ).toBe(sentence)
  })

  it('shows a host sentence with no fact beside it as written', () => {
    expect(
      agentSessionWriteNoticeText(
        structuredAgentSessionRejectionParts('Claude does not support .bmp images', 'send')
      )
    ).toBe('Claude does not support .bmp images')
  })
})
