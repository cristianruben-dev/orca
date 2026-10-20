import type { StarNagPromptMode, StarNagPromptSource } from '../../shared/star-nag-telemetry'

// One visible star prompt: how it was shown and the star attempt in flight, if any.
export type StarNagPromptSession = {
  source: StarNagPromptSource
  mode: StarNagPromptMode
  starAttemptPromise?: Promise<boolean>
}
