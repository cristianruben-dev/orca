import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

export type DesktopScriptPlatform = 'linux'

export function desktopScriptPlatform(): DesktopScriptPlatform | null {
  if (process.platform === 'linux') {
    return 'linux'
  }
  return null
}

export function resolveDesktopScriptProviderPath(
  platform = desktopScriptPlatform()
): string | null {
  const override = process.env.ORCA_COMPUTER_DESKTOP_SCRIPT_PROVIDER_PATH
  if (override && existsSync(override)) {
    return override
  }
  if (!platform) {
    return null
  }

  const filename = 'runtime.py'
  const directory = 'computer-use-linux'
  const sourceDirectory = 'native/computer-use-linux'
  const packaged = [join(process.resourcesPath ?? '', directory, filename)]
  const dev = [
    join(process.cwd(), sourceDirectory, filename),
    resolve(__dirname, '../../', sourceDirectory, filename)
  ]
  const candidates = process.resourcesPath ? [...packaged, ...dev] : dev

  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? null
}
