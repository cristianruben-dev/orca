export type WindowsNativeRegistryValue = {
  name?: unknown
  type?: unknown
  value?: unknown
}

export type WindowsNativeRegistryModule = {
  HK: { CU: number; LM: number }
  getRegistryKey: (
    root: number,
    path: string
  ) => Record<string, WindowsNativeRegistryValue | undefined> | null | undefined
}

export const WINDOWS_REG_SZ = 1
export const WINDOWS_REG_EXPAND_SZ = 2

export function loadWindowsNativeRegistry(): WindowsNativeRegistryModule {
  return {
    HK: { CU: 1, LM: 2 },
    getRegistryKey: () => null
  }
}
