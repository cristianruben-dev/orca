/**
 * The relays an older Orca left listening for this target, and each one's own `--connect` command.
 * COMPAT(legacy-relay-bridge): revisit 2027-01-15.
 *
 * Read-only: lists sockets or pipes and reads each daemon's argv; never starts, stops or removes
 * anything. Another desktop's relay hashes another target id, so it is never listed here.
 */
import type { SshConnection } from '../connection/ssh-connection'
import { quotePosixShell } from '../../../shared/shell-argument-quoting'
import { RELAY_REMOTE_DIR } from '../remote-exec/remote-frame-protocol'
import { SHORT_RELAY_SOCKET_DIR_PREFIX } from '../relay-socket-path-limit'
import { execCommand } from '../remote-exec/remote-exec-command'
import { readRelayDaemonRuntimes } from './ssh-relay-endpoint-runtime'
import { relaySocketNameForInstanceId } from './ssh-relay-instance-id'
import { probeRelayEndpointIncumbent } from './ssh-relay-endpoint-incumbent'
import { readRemoteHomeCommand } from '../ssh-remote-commands'
import { resolveRemoteNodePath } from '../ssh-remote-node-resolution'
import { detectRemoteHostPlatform } from '../ssh-remote-platform-detection'
import {
  normalizeRemoteHome,
  validateRemoteHome,
  type RemoteHostPlatform
} from '../ssh-remote-platform'

const MAX_ENDPOINTS = 32

export type LegacyRelayEndpoint = {
  /** The socket path, or the Windows pipe path. */
  endpoint: string
  /** The relay's own `relay.js --connect`; null when no Node is known to run it with. */
  connectCommand: string | null
  /** POSIX commands run through the login-shell wrapper; Windows PowerShell commands do not. */
  wrapCommand: boolean
  host: RemoteHostPlatform
  nodePath: string | null
}

export type LegacyRelayEndpointListing =
  | {
      kind: 'listed'
      endpoints: LegacyRelayEndpoint[]
      /** False when a relay may run that no endpoint here accounts for, so absence proves nothing. */
      exhaustive: boolean
    }
  | { kind: 'unverifiable' }

export function legacyRelayEndpointListCommand(remoteHome: string, sockName: string): string {
  const name = quotePosixShell(sockName)
  return [
    `base=${quotePosixShell(`${remoteHome}/${RELAY_REMOTE_DIR}`)}`,
    `short_base="${SHORT_RELAY_SOCKET_DIR_PREFIX}$(id -u 2>/dev/null)"`,
    `for sock in "$base"/relay-*/${name} "$short_base"/relay-*/${name}; do`,
    '  [ -S "$sock" ] && printf \'%s\\n\' "$sock"',
    'done',
    'true'
  ].join('\n')
}

/**
 * The relay's own bridge, run from its own version directory so it presents its own build hash.
 * A socket relocated under the short `/tmp` base (long `$HOME`) keeps its `relay.js` and credential
 * in the matching `~/.orca-remote/relay-<version>/`, where every relay of that era wrote them.
 */
export function posixLegacyRelayConnectCommand(
  remoteHome: string,
  nodePath: string,
  sockPath: string
): string | null {
  const slash = sockPath.lastIndexOf('/')
  const sockDir = sockPath.slice(0, slash)
  const versionDir = sockDir.slice(sockDir.lastIndexOf('/') + 1)
  const sockName = sockPath.slice(slash + 1)
  if (slash <= 0 || !versionDir.startsWith('relay-') || !sockName) {
    return null
  }
  const relayDir = `${remoteHome}/${RELAY_REMOTE_DIR}/${versionDir}`
  return (
    `cd ${quotePosixShell(relayDir)} && ${quotePosixShell(nodePath)} relay.js --connect ` +
    `--sock-path ${quotePosixShell(sockPath)} ` +
    `--credential-file ${quotePosixShell(`${relayDir}/${sockName}.credential`)}`
  )
}

export async function listLegacyRelayEndpoints(
  conn: SshConnection,
  targetId: string,
  signal?: AbortSignal
): Promise<LegacyRelayEndpointListing> {
  try {
    const host = await detectRemoteHostPlatform(conn, { signal })
    if (!host) {
      return { kind: 'unverifiable' }
    }
    const remoteHome = normalizeRemoteHome(
      await execCommand(conn, readRemoteHomeCommand(host), { signal, wrapCommand: true }),
      host
    )
    if (!validateRemoteHome(remoteHome, host)) {
      return { kind: 'unverifiable' }
    }
    const sockName = relaySocketNameForInstanceId(targetId)
    return await listPosixEndpoints(conn, host, remoteHome, sockName, signal)
  } catch {
    return { kind: 'unverifiable' }
  }
}

async function listPosixEndpoints(
  conn: SshConnection,
  host: RemoteHostPlatform,
  remoteHome: string,
  sockName: string,
  signal: AbortSignal | undefined
): Promise<LegacyRelayEndpointListing> {
  const listing = await execCommand(conn, legacyRelayEndpointListCommand(remoteHome, sockName), {
    signal,
    wrapCommand: true
  })
  const sockets = listing
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('/'))
  if (sockets.length > MAX_ENDPOINTS) {
    return { kind: 'unverifiable' }
  }
  if (sockets.length === 0) {
    return { kind: 'listed', endpoints: [], exhaustive: true }
  }
  // Each relay is driven with the runtime it runs on; a socket whose daemon is gone with any Node.
  const runtimes = await readRelayDaemonRuntimes(conn, signal)
  let fallback: Promise<string | null> | undefined
  const endpoints: LegacyRelayEndpoint[] = []
  for (const sockPath of sockets) {
    const nodePath =
      runtimes.get(sockPath) ??
      (await (fallback ??= resolveRemoteNodePath(conn, host, { signal }).catch(() => null)))
    endpoints.push({
      endpoint: sockPath,
      connectCommand: nodePath
        ? posixLegacyRelayConnectCommand(remoteHome, nodePath, sockPath)
        : null,
      wrapCommand: true,
      host,
      nodePath
    })
  }
  return { kind: 'listed', endpoints, exhaustive: true }
}

/** A dead socket is the one failed open that proves its relay gone. */
export async function posixEndpointExited(
  conn: SshConnection,
  endpoint: LegacyRelayEndpoint
): Promise<boolean> {
  if (!endpoint.nodePath) {
    return false
  }
  const incumbent = await probeRelayEndpointIncumbent(
    conn,
    endpoint.host,
    endpoint.nodePath,
    endpoint.endpoint
  )
  return incumbent.verdict === 'exited'
}
