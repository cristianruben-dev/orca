export type GrantAccessOptions = {
  inheritable: boolean
  replace: boolean
}

export type WindowsAce = { type: number; flags: number; mask: number; sid: string | null }
export type WindowsDacl = { protected: boolean; aces: WindowsAce[] }

export type WindowsSecurityAddon = {
  currentUserSid: () => string
  getDaclAces: (path: string) => WindowsDacl | null
  setDaclSddl: (path: string, sddl: string) => void
  setDaclSddlAsync: (path: string, sddl: string) => Promise<void>
  createFileWithDacl: (path: string, sddl: string, data: Uint8Array) => void
  grantAccess: (path: string, sid: string, accessMask: number, options: GrantAccessOptions) => void
  grantAccessAsync: (
    path: string,
    sid: string,
    accessMask: number,
    options: GrantAccessOptions
  ) => Promise<void>
}

export type WindowsSecurity = {
  addon: Omit<WindowsSecurityAddon, 'currentUserSid'>
  userSid: string
}

export const WINDOWS_FILE_ALL_ACCESS = 0x1f01ff
export const WINDOWS_FILE_READ_EXECUTE = 0x1200a9

let loaded: WindowsSecurity | { error: string } | null = null

export function loadWindowsSecurity(): WindowsSecurity | { error: string } {
  loaded ??= { error: 'unsupported on posix' }
  return loaded
}

export function setWindowsSecurityForTests(addon: WindowsSecurityAddon | null): void {
  loaded = addon
    ? {
        userSid: addon.currentUserSid(),
        addon: {
          getDaclAces: (path) => addon.getDaclAces(path),
          setDaclSddl: (path, sddl) => addon.setDaclSddl(path, sddl),
          setDaclSddlAsync: (path, sddl) => addon.setDaclSddlAsync(path, sddl),
          createFileWithDacl: (path, sddl, data) => addon.createFileWithDacl(path, sddl, data),
          grantAccess: (path, sid, mask, options) => addon.grantAccess(path, sid, mask, options),
          grantAccessAsync: (path, sid, mask, options) =>
            addon.grantAccessAsync(path, sid, mask, options)
        }
      }
    : { error: 'disabled for tests' }
}

export function resetWindowsSecurityLoadForTests(): void {
  loaded = null
}
