// Astra pass 4 §2: desktop A leases nothing, but desktop B's live shell, under another target id on
// the same account, must never read as exited. COMPAT(legacy-relay-bridge): the host converts anyway
// and leaves B's relay alone, so the census reads `bridged` with nothing of A's to serve.
import type * as ExecCommandModule from './remote-exec/remote-exec-command'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SshConnection } from './connection/ssh-connection'
import { relaySocketNameForInstanceId } from './legacy-relay/ssh-relay-instance-id'
import { getRemoteHostPlatform } from './ssh-remote-platform'

const {
  execCommand,
  probeRelayEndpointIncumbent,
  countRelayEndpointPtys,
  countRelayPtysOverBridge
} = vi.hoisted(() => ({
  execCommand: vi.fn(),
  probeRelayEndpointIncumbent: vi.fn(),
  countRelayEndpointPtys: vi.fn(),
  countRelayPtysOverBridge: vi.fn()
}))

vi.mock('./remote-exec/remote-exec-command', async (importOriginal) => ({
  ...(await importOriginal<typeof ExecCommandModule>()),
  execCommand
}))
vi.mock('./legacy-relay/ssh-relay-endpoint-incumbent', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  probeRelayEndpointIncumbent
}))
vi.mock('./legacy-relay/ssh-relay-endpoint-pty-count', () => ({
  countRelayEndpointPtys,
  countRelayPtysOverBridge
}))
vi.mock('./legacy-relay/ssh-relay-endpoint-runtime', () => ({
  readRelayDaemonRuntimes: async () => new Map()
}))
vi.mock('./ssh-remote-commands', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listRemoteInstallBaseDirsCommand: () => 'LIST'
}))

import { assessOrcadMigrationTerminals } from './orcad-migration-terminal-gate'
import { censusHostRelayEndpoints } from './legacy-relay/ssh-host-relay-endpoint-census'
import { hostTerminalProofFromCensus } from './legacy-relay/ssh-host-relay-terminals-on-connect'

// The censuses only hand the connection to the mocked exec, probe and bridge.
const conn: SshConnection = Object.create(null)
const noLeases = { getSshRemotePtyLeases: () => [] }

describe('a desktop converting while another desktop runs a shell on the account', () => {
  beforeEach(() => {
    execCommand.mockReset()
    probeRelayEndpointIncumbent.mockReset()
    countRelayEndpointPtys.mockReset()
    countRelayPtysOverBridge.mockReset()
  })

  it('never reads exited on a POSIX host where only desktop B’s socket runs a shell', async () => {
    const host = getRemoteHostPlatform('linux-x64')
    const dir = '/home/dev/.orca-remote/relay-0.1.0+aaaaaaaaaaaa'
    const aSock = `${dir}/${relaySocketNameForInstanceId('desktop-a')}`
    const bSock = `${dir}/${relaySocketNameForInstanceId('desktop-b')}`
    execCommand.mockResolvedValue(`${aSock}\n${bSock}\n`)
    probeRelayEndpointIncumbent.mockResolvedValue({ verdict: 'live', holders: [] })
    countRelayEndpointPtys.mockImplementation(async (_c: unknown, _n: string, endpoint: string) =>
      endpoint === bSock ? 1 : 0
    )
    const census = async () =>
      hostTerminalProofFromCensus(
        await censusHostRelayEndpoints(conn, {
          host,
          remoteHome: '/home/dev',
          fallbackNodePath: async () => '/usr/bin/node'
        })
      )

    await expect(assessOrcadMigrationTerminals(noLeases, 'desktop-a', census)).resolves.toEqual({
      verdict: 'bridged',
      relayVerdict: 'live',
      bridgedPtyIds: [],
      hostTerminals: 1
    })

    countRelayEndpointPtys.mockResolvedValue(0)
    await expect(assessOrcadMigrationTerminals(noLeases, 'desktop-a', census)).resolves.toEqual({
      verdict: 'exited',
      provenPtyIds: []
    })
  })

  it('is unverifiable when the host-wide census cannot answer', async () => {
    await expect(
      assessOrcadMigrationTerminals(noLeases, 'desktop-a', async () => {
        throw new Error('connect refused')
      })
    ).resolves.toMatchObject({ verdict: 'bridged', relayVerdict: 'unverifiable' })
  })
})
