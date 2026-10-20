import { reportStructuredSessionUserInput } from '@/lib/worker-terminal-takeover-report'
import type { NativeChatStructuredComposerTransport } from './native-chat-composer-types'

// User admission owns takeover and reveal; draft consumption belongs only to draft submission.
export function completeNativeChatStructuredUserAction(
  transport: NativeChatStructuredComposerTransport,
  revealsTranscript: boolean
): void {
  if (revealsTranscript) {
    transport.onSubmitted?.()
  }
  reportStructuredSessionUserInput(transport.sessionId, transport.runtimeEnvironmentId)
}
