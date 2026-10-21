/**
 * Waiting for a launched orcad's readiness line on the host, not across SSH.
 *
 * The client used to re-read the readiness file every 500 ms, one exec each, for up to three
 * minutes. One exec now waits host-side for a complete line, an
 * oversized file, or its own bounded deadline.
 */
import { quotePosixShell } from '../../../shared/shell-argument-quoting'
import { joinRemotePath, type RemoteHostPlatform } from '../../ssh/ssh-remote-platform'
import { ORCAD_READINESS_FILENAME, ORCAD_READINESS_MAX_BYTES } from './orcad-remote-host-support'
import {
  parseOrcadReadinessOutput,
  readOrcadReadinessCommand,
  type OrcadReadinessParse
} from './orcad-remote-launch'

/** Under the 30 s exec timeout, so one wait never reads as an unanswered host. */
export const ORCAD_READINESS_WAIT_MAX_SECONDS = 20

/** Settles on a newline (a finished line) or more than the cap; both are final for the parser. */
function posixReadinessWaitCommand(
  host: RemoteHostPlatform,
  remoteInstallDir: string,
  waitSeconds: number
): string {
  const file = quotePosixShell(joinRemotePath(host, remoteInstallDir, ORCAD_READINESS_FILENAME))
  const read = `head -c ${ORCAD_READINESS_MAX_BYTES + 1} ${file} 2>/dev/null`
  return [
    // Fractional sleep is not POSIX; probe it once so polling stays fine-grained where it can.
    'if sleep 0.25 2>/dev/null; then orcad_readiness_wait_step=0.25;',
    'else orcad_readiness_wait_step=1; fi;',
    // Why a wall-clock deadline, not a step count: on a loaded host each step's reads take far
    // longer than its sleep, a counted loop overran the client's exec timeout, and the launch
    // was failed while the candidate was still starting (BUG-17).
    `orcad_readiness_wait_end=$(($(date +%s) + ${waitSeconds}));`,
    'while [ "$(date +%s)" -lt "$orcad_readiness_wait_end" ]; do',
    `[ "$(${read} | wc -l)" -gt 0 ] && break;`,
    `[ "$(${read} | wc -c)" -gt ${ORCAD_READINESS_MAX_BYTES} ] && break;`,
    'sleep "$orcad_readiness_wait_step"; done;',
    `${read} || true`
  ].join(' ')
}

export function orcadReadinessWaitCommand(
  host: RemoteHostPlatform,
  remoteInstallDir: string,
  waitSeconds: number
): string {
  const seconds = Math.max(0, Math.min(ORCAD_READINESS_WAIT_MAX_SECONDS, Math.ceil(waitSeconds)))
  return posixReadinessWaitCommand(host, remoteInstallDir, seconds)
}

/** What the readiness file held when the host stopped waiting; `pending` if still unfinished. */
export function parseOrcadReadinessWaitOutput(
  _host: RemoteHostPlatform,
  output: string
): OrcadReadinessParse {
  return parseOrcadReadinessOutput(output)
}

/** Reads the readiness line as it stands; parse with `parseOrcadReadinessWaitOutput`. */
export function readOrcadReadinessNowCommand(
  host: RemoteHostPlatform,
  remoteInstallDir: string
): string {
  return readOrcadReadinessCommand(host, remoteInstallDir)
}
