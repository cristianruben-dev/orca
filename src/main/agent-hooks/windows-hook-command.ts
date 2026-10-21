export const WINDOWS_CMD_SAFE_PATH = /^[A-Za-z0-9_.:\\~-]+$/

export function isSafeUnicodeWindowsBatchHookPath(_scriptPath: string): boolean {
  return false
}

export function wrapWindowsHookCommand(
  scriptPath: string,
  _env: Record<string, string> = {},
  _options: unknown = {}
): string {
  return scriptPath
}

export function buildWindowsHookPowerShellCommand(
  scriptPath: string,
  _env: Record<string, string> = {},
  _options: unknown = {}
): string {
  return scriptPath
}
