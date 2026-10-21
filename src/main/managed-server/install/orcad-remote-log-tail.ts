/**
 * The end of a slot's orcad.log, appended to a failed deploy, launch or rollback so the error
 * says why orcad stopped rather than only where its log is. Errors and the main log only; never
 * telemetry. Best-effort: a host that can't answer leaves the error as it was.
 */
import { redactString } from '../../observability/redactor'
import { quotePosixShell } from '../../../shared/shell-argument-quoting'
import { ORCAD_LOG_FILENAME } from './orcad-remote-host-support'
import { execCommand } from '../../ssh/remote-exec/remote-exec-command'
import { joinRemotePath, type RemoteHostPlatform } from '../../ssh/ssh-remote-platform'
import type { OrcadRemoteExecTarget } from './orcad-remote-runtime-control'

export const ORCAD_LOG_TAIL_LINES = 40
export const ORCAD_LOG_TAIL_MAX_BYTES = 8 * 1024
// Short, because it only decorates an error the caller already has.
const ORCAD_LOG_TAIL_TIMEOUT_MS = 10_000

export function orcadLogTailCommand(host: RemoteHostPlatform, slotDir: string): string {
  const log = joinRemotePath(host, slotDir, ORCAD_LOG_FILENAME)
  return `tail -c ${ORCAD_LOG_TAIL_MAX_BYTES} ${quotePosixShell(log)} 2>/dev/null || true`
}

/** The last lines of what the host printed, redacted; null when the log is empty or absent. */
export function parseOrcadLogTail(_host: RemoteHostPlatform, output: string): string | null {
  const bounded = Buffer.from(output, 'utf8').subarray(-ORCAD_LOG_TAIL_MAX_BYTES).toString('utf8')
  const lines = bounded.replace(/\s+$/u, '').split(/\r?\n/u).slice(-ORCAD_LOG_TAIL_LINES)
  const tail = redactString(lines.join('\n'))
  return tail.trim() ? tail : null
}

export async function readOrcadLogTail(
  target: OrcadRemoteExecTarget,
  slotDir: string
): Promise<string | null> {
  try {
    // No abort signal: the failure being reported may be the cancellation itself.
    const output = await execCommand(target.conn, orcadLogTailCommand(target.host, slotDir), {
      wrapCommand: true,
      timeoutMs: ORCAD_LOG_TAIL_TIMEOUT_MS
    })
    return parseOrcadLogTail(target.host, output)
  } catch (error) {
    console.warn('[ssh] Could not read the orcad.log tail:', error)
    return null
  }
}

/** `message` followed by the log tail, or `message` alone when the host had none to give. */
export async function withOrcadLogTail(
  target: OrcadRemoteExecTarget,
  slotDir: string,
  message: string
): Promise<string> {
  const tail = await readOrcadLogTail(target, slotDir)
  return tail ? `${message}\nLast lines of orcad.log:\n${tail}` : message
}
