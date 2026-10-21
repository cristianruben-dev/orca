import type { ITerminalOptions } from '@xterm/xterm'
import type { ExecutionHostId } from '../../../../shared/execution-host'

export type WindowsPtyCompatibilityContext = {
  userAgent?: string
  osRelease?: string
  connectionId: string | null | undefined
  cwd?: string | null
  shellOverride?: string | null
}

export function buildWindowsPtyCompatibilityOptions(
  _context: WindowsPtyCompatibilityContext & { executionHostId: ExecutionHostId }
): Partial<ITerminalOptions> {
  return {}
}

export function buildLocalConptyTerminalOptions(
  _osRelease: string | null | undefined
): Partial<ITerminalOptions> {
  return {}
}

export function resolveWindowsShellOverride(
  tabShellOverride: string | null | undefined,
  _globalWindowsShell: string | null | undefined
): string | undefined {
  return tabShellOverride ?? undefined
}

export function isLocalNativeWindowsPty(_context: WindowsPtyCompatibilityContext): boolean {
  return false
}

export function isLocalNativeWindowsConpty(
  _context: WindowsPtyCompatibilityContext & { executionHostId: ExecutionHostId }
): boolean {
  return false
}
