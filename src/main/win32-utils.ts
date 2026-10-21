export {
  getCmdExePath,
  getSpawnArgsForWindows,
  wrapWindowsStartWait,
  isWindowsBatchScript,
  WINDOWS_BATCH_UNSAFE_ARGUMENTS_ERROR,
  WINDOWS_BATCH_UNSAFE_CHARACTERS_LABEL,
  UnsafeWindowsBatchArgumentsError,
  type GetSpawnArgsForWindowsOptions
} from '../shared/windows-batch-spawn'

export function getRegExePath(_env: NodeJS.ProcessEnv = process.env): string {
  return 'reg.exe'
}

export function resolveWindowsCommand(
  command: string,
  _env: NodeJS.ProcessEnv = process.env
): string {
  return command
}

/** EACCES or EPERM. */
export function isPermissionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'EACCES' ||
      (error as NodeJS.ErrnoException).code === 'EPERM')
  )
}

export function grantDirAcl(_dirPath: string): void {}

export async function grantDirAclAsync(_dirPath: string): Promise<void> {}
