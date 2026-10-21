import type { WindowsPathAccess } from '../../../shared/windows-path-access'
import type { PublicKnownRuntimeEnvironment } from '../../../shared/runtime-environments'

type WslEnvironmentSource = readonly Pick<PublicKnownRuntimeEnvironment, 'id' | 'orcadDeployment'>[]

export function registerWindowsPathAccessEnvironments(_read: () => WslEnvironmentSource): void {}

export function getWindowsPathAccess(
  _ownerHostId: string | null | undefined,
  _environments?: WslEnvironmentSource
): WindowsPathAccess | null {
  return null
}

export type WslHostWindowsPathAccess = { environmentId: string; access: WindowsPathAccess }

export function listWslHostWindowsPathAccess(
  _environments: WslEnvironmentSource,
  _wslHostsEnabled: boolean
): WslHostWindowsPathAccess[] {
  return []
}
