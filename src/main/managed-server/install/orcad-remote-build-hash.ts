/** The installed entry bytes, hashed as the server reports them for activation and rollback. */
import { ORCAD_LAUNCHER_FILENAME } from '../../../shared/orcad-artifacts'
import { quotePosixShell } from '../../../shared/shell-argument-quoting'
import { execOrcadRemote, type OrcadRemoteExecTarget } from './orcad-remote-runtime-control'
import { assertPosixOrcadHost } from './orcad-remote-host-support'
import { joinRemotePath, type RemoteHostPlatform } from '../../ssh/ssh-remote-platform'

export const BUILD_HASH_MARKER = '__ORCAD_BUILD_HASH__'

export async function readRemoteOrcadBuildHash(
  target: OrcadRemoteExecTarget,
  remoteInstallDir: string
): Promise<string> {
  const output = await execOrcadRemote(
    target,
    remoteOrcadBuildHashCommand(target.host, remoteInstallDir)
  )
  const match = output.match(new RegExp(`${BUILD_HASH_MARKER}\\s+([a-fA-F0-9]{16})`, 'u'))
  if (!match?.[1]) {
    throw new Error('Could not verify the installed orcad build hash.')
  }
  return match[1].toLowerCase()
}

export function remoteOrcadBuildHashCommand(
  host: RemoteHostPlatform,
  remoteInstallDir: string
): string {
  assertPosixOrcadHost(host)
  const path = quotePosixShell(joinRemotePath(host, remoteInstallDir, ORCAD_LAUNCHER_FILENAME))
  // Why both tools: GNU/busybox ship sha256sum, macOS ships shasum; either prints the digest first.
  return [
    `[ -f ${path} ] && [ -r ${path} ] || exit 1;`,
    `orca_hash=$(if command -v sha256sum >/dev/null 2>&1; then sha256sum ${path} | awk '{print $1}';`,
    `elif command -v shasum >/dev/null 2>&1; then shasum -a 256 ${path} | awk '{print $1}'; fi);`,
    `case "$orca_hash" in [0-9a-fA-F][0-9a-fA-F]*) printf '%s %.16s\\n' ${quotePosixShell(BUILD_HASH_MARKER)} "$orca_hash";; esac`
  ].join(' ')
}
