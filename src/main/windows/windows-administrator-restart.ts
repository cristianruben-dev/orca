export function getWindowsAdministratorRelaunchOptions(): Electron.RelaunchOptions | undefined {
  return undefined
}

export function prepareWindowsAdministratorRestart(): Electron.RelaunchOptions {
  throw new Error('Administrator restart is not supported on this platform.')
}

export async function restartLocalTerminalsAfterElevation(_signal: AbortSignal): Promise<void> {}
