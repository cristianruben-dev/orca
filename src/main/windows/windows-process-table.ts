/**
 * Process table identity row.
 */
export type WindowsProcessIdentityRow = {
  pid: number
  ppid: number
  name: string
  creationTimeMs?: number
}

/**
 * Process row including command line.
 */
export type WindowsProcessRow = WindowsProcessIdentityRow & {
  command: string
}

export function readWindowsProcessTable(): Promise<WindowsProcessRow[]> {
  return Promise.resolve([])
}

export function readWindowsProcessTableFresh(): Promise<WindowsProcessRow[]> {
  return Promise.resolve([])
}

export function readWindowsProcessIdentityTable(): Promise<WindowsProcessIdentityRow[]> {
  return Promise.resolve([])
}

export function readWindowsProcessIdentityTableFresh(): Promise<WindowsProcessIdentityRow[]> {
  return Promise.resolve([])
}

export function isWindowsProcessTableAvailable(): boolean {
  return false
}

export function isWindowsProcessStartTimeAvailable(): boolean {
  return false
}

export function readWindowsProcessCreationTime(_pid: number): number | null {
  return null
}

export function __setWindowsProcessTreeLoaderForTests(_loader?: unknown): void {}
export function __setWindowsProcessTreeRequireForTests(_require?: unknown): void {}
export function __setWindowsProcessTableCimScanForTests(_cim?: unknown): void {}
export function resetWindowsProcessTableForTests(): void {}
