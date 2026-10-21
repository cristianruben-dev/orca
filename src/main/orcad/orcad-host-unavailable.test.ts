import { describe, expect, it } from 'vitest'
import {
  classifyOrcadHostUnavailable,
  orcadCandidateLaunchFailureCode,
  OrcadHostUnsupportedError
} from './orcad-host-unavailable'

describe('classifyOrcadHostUnavailable', () => {
  it('classifies unsupported host errors', () => {
    const error = new OrcadHostUnsupportedError('unsupported')
    expect(classifyOrcadHostUnavailable(error)).toBe('unsupported_host')
  })

  it('keeps an ordinary launch failure retryable', () => {
    expect(orcadCandidateLaunchFailureCode(new Error('spawn failed'))).toBe(
      'orcad_candidate_launch_failed'
    )
    expect(
      classifyOrcadHostUnavailable({
        code: orcadCandidateLaunchFailureCode(new Error('spawn failed'))
      })
    ).toBeNull()
  })
})
