/** Whether the pre-activation snapshot fits, asked before the running server is stopped (#30491). */
import { RELAY_REMOTE_DIR } from './remote-exec/remote-frame-protocol'
import { execOrcadRemoteOr } from '../managed-server/install/orcad-remote-runtime-control'
import {
  ORCAD_STATE_SNAPSHOT_DIR,
  type OrcadActivationRecord
} from '../managed-server/activation/orcad-activation-record'
import {
  orcadSnapshotShortfallKb,
  orcadSnapshotShortfallMessage,
  orcadSnapshotSpaceCommand,
  parseOrcadSnapshotSpace
} from '../managed-server/host-state/orcad-state-snapshot-space'
import { joinRemotePath, type RemoteHostPlatform } from './ssh-remote-platform'
import { isUnconfirmedSshCommandTermination } from './remote-exec/remote-exec-command'
import type { OrcadSlotOptions } from './orcad-recovery-slot'

function orcadRemoteBaseDir(host: RemoteHostPlatform, remoteHome: string): string {
  return joinRemotePath(host, remoteHome, RELAY_REMOTE_DIR)
}

export const ORCAD_SNAPSHOT_SPACE_INSUFFICIENT_CODE = 'orcad_snapshot_space_insufficient'

export function orcadSnapshotsRoot(options: Pick<OrcadSlotOptions, 'host' | 'remoteHome'>): string {
  return joinRemotePath(
    options.host,
    orcadRemoteBaseDir(options.host, options.remoteHome),
    ORCAD_STATE_SNAPSHOT_DIR
  )
}

/** The refusal to show when the snapshot cannot fit, or null to go ahead (an unread answer too). */
export async function orcadSnapshotRoomRefusal(
  options: OrcadSlotOptions,
  record: OrcadActivationRecord,
  fullVersion: string
): Promise<string | null> {
  const baseDir = orcadRemoteBaseDir(options.host, options.remoteHome)
  const command = orcadSnapshotSpaceCommand(
    options.host,
    options.userDataDir,
    orcadSnapshotsRoot(options),
    baseDir,
    record.snapshot ? [record.snapshot.dirName] : []
  )
  if (!command) {
    return null
  }
  const space = parseOrcadSnapshotSpace(await measureRoom(options, command))
  const shortfall = orcadSnapshotShortfallKb(space)
  return space && shortfall !== null
    ? orcadSnapshotShortfallMessage(space, shortfall, {
        userDataDir: options.userDataDir,
        baseDir,
        fullVersion,
        active: record.active
      })
    : null
}

async function measureRoom(options: OrcadSlotOptions, command: string): Promise<string> {
  try {
    return await execOrcadRemoteOr(options, command)
  } catch (error) {
    // A read-only probe that lost its channel only leaves the room unknown; the capture decides.
    if (isUnconfirmedSshCommandTermination(error) && !options.signal?.aborted) {
      return ''
    }
    throw error
  }
}
