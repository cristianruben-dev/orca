export const WINDOWS_NATIVE_HOOK_EXECUTABLE_NAME = 'orca-agent-hook.exe'

export function getWindowsNativeHookAgent(scriptPath: string): string {
  return scriptPath
}

export function resolveBundledWindowsNativeHookExecutable(): string | null {
  return null
}
