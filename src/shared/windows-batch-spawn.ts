export function getCmdExePath(): string {
  return process.env.ComSpec || 'cmd.exe'
}

export function isWindowsBatchScript(_commandPath: string): boolean {
  return false
}

export const WINDOWS_BATCH_UNSAFE_ARGUMENTS_ERROR = 'UNSAFE_WINDOWS_BATCH_ARGUMENTS'

export class UnsafeWindowsBatchArgumentsError extends Error {
  constructor() {
    super(WINDOWS_BATCH_UNSAFE_ARGUMENTS_ERROR)
    this.name = 'UnsafeWindowsBatchArgumentsError'
  }
}

export const WINDOWS_BATCH_UNSAFE_CHARACTERS_LABEL = '& | < > ^ " % !'

export type GetSpawnArgsForWindowsOptions = {
  detachedGui?: boolean
}

export function getSpawnArgsForWindows(
  command: string,
  args: string[],
  _options: GetSpawnArgsForWindowsOptions = {}
): { spawnCmd: string; spawnArgs: string[] } {
  return { spawnCmd: command, spawnArgs: args }
}

export function wrapWindowsStartWait(
  spawnCmd: string,
  spawnArgs: string[]
): { spawnCmd: string; spawnArgs: string[] } {
  return { spawnCmd, spawnArgs }
}
