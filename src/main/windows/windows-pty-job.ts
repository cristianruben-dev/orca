import type { IPty } from 'node-pty'

export type JobTerminationOutcome = 'terminated' | 'unavailable'

/** The gate's pid never proves that its user shell remains alive. */
export function ptyShellProcessId(proc: IPty): number | undefined {
  return proc.pid
}

export function terminatePtyJob(_proc: IPty): JobTerminationOutcome {
  return 'unavailable'
}

export function listPtyJobProcessIds(_proc: IPty): readonly number[] | null {
  return null
}

export function assignHostProcessToKillOnCloseJob(): boolean {
  return false
}

export function setPtyActiveProcessLimit(_limit: number): boolean {
  return false
}

export function isPtyJobOwnershipAvailable(): boolean {
  return false
}

export function __setConptyJobNativeForTests(_native?: unknown): void {}
