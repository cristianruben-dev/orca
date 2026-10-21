import { randomUUID } from 'node:crypto'
import { ORCAD_NODE_RUNTIME_IDENTITY } from '../../../shared/orcad-node-runtime-identity'
import { ORCAD_NODE_RUNTIME_MARKER_FILENAME } from '../../../shared/orcad-artifacts'
import {
  ORCAD_PROFILE_PREFLIGHT_FLAG,
  ORCAD_PROFILE_PREFLIGHT_TIMEOUT_MS,
  parseOrcadProfilePreflight
} from '../../../shared/orcad-profile-preflight'
import { assertPosixOrcadHost } from './orcad-remote-host-support'
import { orcadNodeSlotRuntimeCommand, selectOrcadSlotEntryCommand } from './orcad-remote-runtime'
import { execCommand } from '../../ssh/remote-exec/remote-exec-command'
import { quotePosixShell } from '../../../shared/shell-argument-quoting'
import { joinRemotePath, type RemoteHostPlatform } from '../../ssh/ssh-remote-platform'
import type { OrcadHostTransport } from '../../ssh/orcad-host-transport'

export function orcadProfilePreflightCommand(
  host: RemoteHostPlatform,
  directory: string,
  nonce: string
): string {
  assertPosixOrcadHost(host)
  // Why no host-Node fallback: a candidate this client installed is always a Node slot.
  const marker = quotePosixShell(
    joinRemotePath(host, directory, ORCAD_NODE_RUNTIME_MARKER_FILENAME)
  )
  const launch = [
    'ORCA_BACKGROUND_LAUNCH=1',
    '"$orcad_runtime"',
    '"$orcad_entry"',
    ORCAD_PROFILE_PREFLIGHT_FLAG,
    quotePosixShell(nonce)
  ].join(' ')
  return `[ -e ${marker} ] || exit 78; ${orcadNodeSlotRuntimeCommand(host, directory)}${selectOrcadSlotEntryCommand(host, directory)}; ${launch}`
}

/** Failure leaves the incumbent and its data untouched, including an unconfirmed SSH exit. */
export async function preflightInstalledOrcad(options: {
  conn: OrcadHostTransport
  host: RemoteHostPlatform
  remoteInstallDir: string
  fullVersion: string
  signal?: AbortSignal
}): Promise<void> {
  const nonce = randomUUID()
  const command = orcadProfilePreflightCommand(options.host, options.remoteInstallDir, nonce)
  const output = await execCommand(options.conn, command, {
    signal: options.signal,
    timeoutMs: ORCAD_PROFILE_PREFLIGHT_TIMEOUT_MS,
    wrapCommand: true
  })
  parseOrcadProfilePreflight(output, nonce, ORCAD_NODE_RUNTIME_IDENTITY, options.fullVersion)
}
