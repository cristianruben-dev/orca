import type { RemoteInstallTransport } from '../managed-server/install/remote-install-transport'
import {
  getProcessOutputFields,
  iterateProcessOutputLines
} from '../../shared/process-output-field-scanner'
import { parseUnameToRelayPlatform, type RelayPlatform } from './remote-exec/remote-frame-protocol'
import { execCommand } from './remote-exec/remote-exec-command'
import { getRemoteHostPlatform, type RemoteHostPlatform } from './ssh-remote-platform'

const PLATFORM_PROBE_MARKER = '__ORCA_REMOTE_PLATFORM__'
const MAX_UNAME_FIELD_CHARS = 64
const MAX_THROWN_OUTPUT_CHARS = 200
const MAX_LOGGED_OUTPUT_CHARS = 1000

type PlatformProbeOutcome =
  | { kind: 'detected'; platform: RelayPlatform }
  | { kind: 'unsupported'; uname: string }
  | { kind: 'unparsed'; output: string }
  | { kind: 'failed'; error: unknown }

export async function detectRemoteHostPlatform(
  conn: RemoteInstallTransport,
  options?: { signal?: AbortSignal }
): Promise<RemoteHostPlatform | null> {
  const uname = await detectUnamePlatform(conn, options?.signal)
  if (uname.kind === 'detected') {
    return getRemoteHostPlatform(uname.platform)
  }
  if (uname.kind === 'unsupported') {
    console.warn(`[ssh-relay] Remote reported an unsupported platform: ${uname.uname}`)
    return null
  }
  if (uname.kind === 'failed') {
    throw wrapProbeError(uname.error)
  }
  console.warn(
    `[ssh-relay] Remote platform detection failed. Remote output: "${summarizeProbeOutput(uname.output, MAX_LOGGED_OUTPUT_CHARS)}"`
  )
  throw unrecognizedOutputError(uname.output)
}

function wrapProbeError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)
  return new Error(`Could not detect the remote platform: ${message}`, { cause: error })
}

function unrecognizedOutputError(output: string): Error {
  return new Error(
    `Remote platform probe returned no recognizable output. Remote output: "${summarizeProbeOutput(output, MAX_THROWN_OUTPUT_CHARS)}"`
  )
}

function summarizeProbeOutput(output: string, maxChars: number): string {
  const collapsed = output.replace(/\s+/gu, ' ').trim()
  return collapsed.length > maxChars ? `…${collapsed.slice(-maxChars)}` : collapsed
}

async function detectUnamePlatform(
  conn: RemoteInstallTransport,
  signal?: AbortSignal
): Promise<PlatformProbeOutcome> {
  try {
    // Why: Remote startup output may omit its trailing newline and must not absorb the marker.
    const command = `printf '\\n%s ' '${PLATFORM_PROBE_MARKER}'; uname -sm`
    const output = signal
      ? await execCommand(conn, command, { signal })
      : await execCommand(conn, command)
    return parseRemotePlatformOutput(output)
  } catch (error) {
    signal?.throwIfAborted()
    return { kind: 'failed', error }
  }
}

function parseRemotePlatformOutput(output: string): PlatformProbeOutcome {
  let unsupportedUname = ''
  // Why: SSH startup noise can resemble valid probe output and select the wrong relay.
  for (const line of iterateProcessOutputLines(output)) {
    const parts = getProcessOutputFields(line, 3)
    if (parts.length < 3 || parts[0] !== PLATFORM_PROBE_MARKER) {
      continue
    }
    const platform = parseUnameToRelayPlatform(parts[1], parts[2])
    if (platform) {
      return { kind: 'detected', platform }
    }
    unsupportedUname = `${clampUnameField(parts[1])} ${clampUnameField(parts[2])}`
  }
  return unsupportedUname
    ? { kind: 'unsupported', uname: unsupportedUname }
    : { kind: 'unparsed', output }
}

// Why: a single field can be kilobytes — the scanner reads up to 4096 chars.
function clampUnameField(field: string): string {
  return field.length > MAX_UNAME_FIELD_CHARS ? `${field.slice(0, MAX_UNAME_FIELD_CHARS)}…` : field
}
