export const WINDOWS_POWERSHELL_HOOK_SWITCHES = '-NoProfile'

export function getWindowsSystem32Path(relativePath: string): string {
  return `C:/Windows/System32/${relativePath}`
}

export function getWindowsPowerShellExecutablePath(): string {
  return getWindowsSystem32Path('WindowsPowerShell/v1.0/powershell.exe')
}

export type WindowsPowerShellHookOptions = {
  useProcessPolicyEnvironment?: boolean
}

export function encodeWindowsPowerShellHookCommand(command: string): string {
  return command
}

export function wrapWindowsPowerShellEncodedCommand(
  command: string,
  _options: WindowsPowerShellHookOptions = {}
): string {
  return command
}
