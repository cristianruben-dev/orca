export type WindowsShellPathHydration = {
  configure: (shell?: string | null, implementation?: unknown) => void
  hydrate: (shell?: string | null, implementation?: unknown) => Promise<void>
  whenReady: () => Promise<void>
}

export function createWindowsShellPathHydration(): WindowsShellPathHydration {
  return {
    configure: () => {},
    hydrate: () => Promise.resolve(),
    whenReady: () => Promise.resolve()
  }
}
