import { afterEach, describe, expect, it } from 'vitest'
import { i18n, setRendererPluginLanguagePacks } from '@/i18n/i18n'
import en from '@/i18n/locales/en.json'
import { pluginLanguageResourceId } from '../../../../shared/plugins/plugin-language-pack-artifact'
import { agentSessionWriteNoticeEnglish } from '../../../../shared/agent-session-refusal-notice'
import {
  AGENT_SESSION_WRITE_NOTICE_COPY,
  type AgentSessionWriteNoticePart,
  type AgentSessionWriteNoticeSentence
} from '../../../../shared/agent-session-write-notice-copy'
import { agentSessionWriteNoticeText } from './agent-session-write-notice-text'

const SENTENCES = Object.keys(AGENT_SESSION_WRITE_NOTICE_COPY).filter(
  (key): key is AgentSessionWriteNoticeSentence => key in AGENT_SESSION_WRITE_NOTICE_COPY
)

afterEach(async () => {
  setRendererPluginLanguagePacks([])
  await i18n.changeLanguage('en')
})

describe('desktop words for a write that did not happen', () => {
  it('says exactly what the phone says in English', () => {
    for (const sentence of SENTENCES) {
      expect(agentSessionWriteNoticeText([sentence])).toBe(
        agentSessionWriteNoticeEnglish([sentence])
      )
    }
  })

  it('keeps the English catalog in step with the shared copy', () => {
    expect(en.components['native-chat'].writeNotice).toEqual(AGENT_SESSION_WRITE_NOTICE_COPY)
  })

  it('translates each sentence whole and shows a provider reason as written', () => {
    expect(agentSessionWriteNoticeText(['restartFailed', 'notDoneSend'])).toBe(
      "The agent couldn't restart. Your message was not sent."
    )
    expect(
      agentSessionWriteNoticeText([{ text: 'Claude messages support at most 20 images' }])
    ).toBe('Claude messages support at most 20 images')
  })

  it('spaces sentences in English', () => {
    // Two sentences from the notice, and two the failure words join inside their own sentence.
    const parts: AgentSessionWriteNoticePart[] = [
      'notDoneSend',
      { failure: { kind: 'startFailed' }, surface: 'rejection', context: { agentName: 'Claude' } }
    ]
    const chat = en.components['native-chat']
    expect(agentSessionWriteNoticeText(parts)).toBe(
      [
        chat.writeNotice.notDoneSend,
        chat.failureWords.couldNotStart.replace('{{agent}}', 'Claude'),
        chat.failureWords.sendToTryAgain
      ].join(' ')
    )
  })

  it("runs on after a plugin language's full stop, and keeps the space after English it left", async () => {
    const id = 'plugin:example.chinese/zh-TW' as const
    setRendererPluginLanguagePacks([
      {
        id,
        resourceLanguage: pluginLanguageResourceId(id),
        pluginKey: 'example.chinese',
        locale: 'zh-TW',
        catalog: {
          components: {
            'native-chat': {
              writeNotice: {
                restartFailed: '智能體無法重新啟動。',
                notDoneSend: '您的訊息未傳送。'
              }
            }
          }
        }
      }
    ])
    await i18n.changeLanguage(pluginLanguageResourceId(id))
    expect(agentSessionWriteNoticeText(['restartFailed', 'notDoneSend'])).toBe(
      '智能體無法重新啟動。您的訊息未傳送。'
    )
    // The pack predates the failure words, so they fall back to English.
    expect(
      agentSessionWriteNoticeText([
        'notDoneSend',
        { failure: { kind: 'startFailed' }, surface: 'rejection', context: { agentName: 'Claude' } }
      ])
    ).toBe("您的訊息未傳送。Claude couldn't start. Send your message to try again.")
  })
})
