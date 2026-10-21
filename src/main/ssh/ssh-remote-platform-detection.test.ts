import type * as ExecCommandModule from './remote-exec/remote-exec-command'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SshConnection } from './connection/ssh-connection'

const execCommandMock = vi.hoisted(() => vi.fn())

vi.mock('./remote-exec/remote-exec-command', async (importOriginal) => ({
  ...(await importOriginal<typeof ExecCommandModule>()),
  execCommand: execCommandMock
}))

const { detectRemoteHostPlatform } = await import('./ssh-remote-platform-detection')

const conn = {} as SshConnection

describe('detectRemoteHostPlatform', () => {
  beforeEach(() => {
    execCommandMock.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('detects POSIX hosts from uname output', async () => {
    execCommandMock.mockResolvedValueOnce('__ORCA_REMOTE_PLATFORM__ Linux   x86_64\n')

    await expect(detectRemoteHostPlatform(conn)).resolves.toMatchObject({
      relayPlatform: 'linux-x64',
      os: 'linux',
      arch: 'x64',
      pathFlavor: 'posix'
    })
    expect(execCommandMock).toHaveBeenCalledWith(
      conn,
      "printf '\\n%s ' '__ORCA_REMOTE_PLATFORM__'; uname -sm"
    )
  })

  it('ignores a marker concatenated to unterminated startup noise', async () => {
    execCommandMock.mockResolvedValueOnce(
      'startup noise__ORCA_REMOTE_PLATFORM__ Linux x86_64\n' +
        '__ORCA_REMOTE_PLATFORM__ Linux arm64\n'
    )

    await expect(detectRemoteHostPlatform(conn)).resolves.toMatchObject({
      relayPlatform: 'linux-arm64'
    })
  })

  it('returns null when probe yields an unsupported platform', async () => {
    execCommandMock.mockResolvedValueOnce('__ORCA_REMOTE_PLATFORM__ FreeBSD x86_64')

    await expect(detectRemoteHostPlatform(conn)).resolves.toBeNull()
  })

  it('does not use whitespace regex splitting for remote platform output', async () => {
    const splitSpy = vi.spyOn(String.prototype, 'split')
    execCommandMock.mockResolvedValueOnce('__ORCA_REMOTE_PLATFORM__ Darwin      arm64 extra')

    await expect(detectRemoteHostPlatform(conn)).resolves.toMatchObject({
      relayPlatform: 'darwin-arm64'
    })

    const usedWhitespaceFieldSplit = splitSpy.mock.calls.some(
      ([separator]) => separator instanceof RegExp && separator.source.includes('\\s+')
    )
    splitSpy.mockRestore()
    expect(usedWhitespaceFieldSplit).toBe(false)
  })

  it('reports the raw probe output when a POSIX host yields no marker line', async () => {
    // Restricted shell / ForceCommand: the probe command is swallowed, banner only.
    execCommandMock.mockResolvedValue('Welcome to pc-server05\n')

    await expect(detectRemoteHostPlatform(conn)).rejects.toThrow(/pc-server05/u)
  })

  it('truncates a long banner in the thrown message but logs a longer tail', async () => {
    execCommandMock.mockResolvedValue(`${'banner line\n'.repeat(500)}goodbye\n`)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const error = await detectRemoteHostPlatform(conn).catch((err: Error) => err)

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).not.toContain('\n')
    expect((error as Error).message.length).toBeLessThanOrEqual(300)
    expect(String(warnSpy.mock.calls[0]?.[0]).length).toBeGreaterThan(600)
  })
})
