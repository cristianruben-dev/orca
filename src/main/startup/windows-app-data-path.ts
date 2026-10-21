export type WindowsAppDataPathHost = {
  getPath(name: 'appData'): string
  setPath(name: 'appData' | 'userData', value: string): void
  getName(): string
  commandLine: { hasSwitch(name: string): boolean }
}

export function deriveWindowsAppDataPath(_env: NodeJS.ProcessEnv): string {
  return ''
}

export function ensureWindowsAppDataPath(
  _host: WindowsAppDataPathHost,
  _env: NodeJS.ProcessEnv = process.env,
  _platform: NodeJS.Platform = process.platform
): void {}
