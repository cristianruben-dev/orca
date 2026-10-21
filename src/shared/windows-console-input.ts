export const WINDOWS_CONSOLE_INPUT_DEVICE = '\\\\.\\CONIN$'

export type WindowsConsoleInput = {
  fd: number
  dispose: () => void
}

type WindowsInteractiveChildStdio = [
  number | 'inherit',
  typeof process.stderr | 'inherit',
  'inherit'
]

/** Opens the console input device instead of inherited stdin. Returns 'inherit' on Unix. */
export function openWindowsConsoleInput(): WindowsConsoleInput | 'inherit' {
  return 'inherit'
}

export function stdioForWindowsInteractiveChild(json: boolean = false): {
  stdio: WindowsInteractiveChildStdio
  dispose: () => void
} {
  return {
    stdio: ['inherit', json ? process.stderr : 'inherit', 'inherit'],
    dispose: () => {}
  }
}
