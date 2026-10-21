import { describe, expect, it } from 'vitest'
import {
  buildTerminalKeyboardProtocolOptions,
  shouldDisableKittyKeyboardForTerminal
} from './terminal-keyboard-protocol'

const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)'
const LINUX_UA = 'Mozilla/5.0 (X11; Linux x86_64)'

describe('shouldDisableKittyKeyboardForTerminal', () => {
  it('keeps Kitty keyboard on macOS', () => {
    expect(
      shouldDisableKittyKeyboardForTerminal({
        userAgent: MAC_UA,
        osRelease: '23.0.0',
        connectionId: null,
        cwd: '/repo',
        shellOverride: null,
        executionHostId: 'local'
      })
    ).toBe(false)
  })

  it('keeps Kitty keyboard on Linux', () => {
    expect(
      shouldDisableKittyKeyboardForTerminal({
        userAgent: LINUX_UA,
        osRelease: '6.5.0',
        connectionId: null,
        cwd: '/repo',
        shellOverride: null,
        executionHostId: 'local'
      })
    ).toBe(false)
  })
})

describe('buildTerminalKeyboardProtocolOptions', () => {
  it('returns no override on macOS/Linux', () => {
    for (const userAgent of [MAC_UA, LINUX_UA]) {
      expect(
        buildTerminalKeyboardProtocolOptions({
          userAgent,
          osRelease: '23.0.0',
          connectionId: null,
          cwd: '/repo',
          shellOverride: null,
          executionHostId: 'local'
        })
      ).toEqual({})
    }
  })
})
