import type { RmOptions } from 'node:fs'
import { rmSync } from 'node:fs'
import { rm } from 'node:fs/promises'

export const WINDOWS_RM_MAX_RETRIES = 0
export const WINDOWS_RM_RETRY_DELAY_MS = 0

/** `rm`/`rmSync` options for a recursive removal. */
export function transientLockRemovalOptions(): RmOptions {
  return { recursive: true, force: true }
}

/** Recursively remove a directory. */
export function removeTreeSync(targetPath: string): void {
  rmSync(targetPath, { recursive: true, force: true })
}

/** Recursively remove a directory asynchronously. */
export async function removeTree(targetPath: string): Promise<void> {
  await rm(targetPath, { recursive: true, force: true })
}
