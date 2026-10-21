import { DirectoryTransferBudget } from '../ssh-directory-transfer-budget'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { lstat, opendir } from 'node:fs/promises'
import { join as pathJoin } from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { SshTarget } from '../../../shared/ssh-types'
import { quotePosixShell } from '../../../shared/shell-argument-quoting'
import { wrapRemoteCommandForPosixShell } from '../ssh-posix-command-wrapper'
import { findSystemSsh } from './system-ssh-binary'
import { buildSshArgs, type SystemSshBuildArgsOptions } from './system-ssh-args'
import { joinRemotePath, type RemoteHostPlatform } from '../ssh-remote-platform'
import {
  awaitWithSystemSshAbort,
  killProcess,
  throwIfAborted,
  waitForProcess,
  isHostAnsweredSystemSshExit,
  type ProcessResult
} from './system-ssh-operation-lifecycle'
import { writeBufferViaSystemSsh } from './system-ssh-file-binary-transfer'

type SystemSshOperationOptions = SystemSshBuildArgsOptions & {
  signal?: AbortSignal
  hostPlatform?: RemoteHostPlatform
}

export async function uploadDirectoryViaSystemSsh(
  target: SshTarget,
  localDir: string,
  remoteDir: string,
  options?: SystemSshOperationOptions
): Promise<void> {
  throwIfAborted(options?.signal)

  const sshPath = findSystemSsh()
  if (!sshPath) {
    throw new Error('No system ssh binary found. Install OpenSSH to use system SSH transport.')
  }

  const tarCreate = spawn('tar', ['-czf', '-', '-C', localDir, '.'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  })
  const remoteCommand = `mkdir -p ${quotePosixShell(remoteDir)} && tar -xzf - -C ${quotePosixShell(remoteDir)}`
  const sshExtract = spawn(
    sshPath,
    [...buildSshArgs(target, options), wrapRemoteCommandForPosixShell(remoteCommand)],
    {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    }
  )

  let tarResult: ProcessResult | null = null
  let sshResult: ProcessResult | null = null
  try {
    ;[tarResult, sshResult] = await awaitWithSystemSshAbort(
      options?.signal,
      () => {
        killProcess(tarCreate)
        killProcess(sshExtract)
      },
      settleUploadPipeline(
        tarCreate,
        waitForProcess(tarCreate, 'local tar relay upload'),
        waitForProcess(sshExtract, 'system ssh relay upload', 'remote'),
        pipeline(tarCreate.stdout!, sshExtract.stdin!)
      )
    )
  } catch (err) {
    killProcess(tarCreate)
    killProcess(sshExtract)
    throw err
  }

  if (tarResult?.stderr.trim()) {
    console.warn(`[ssh-system] ${tarResult.label} stderr: ${tarResult.stderr.trim()}`)
  }
  if (sshResult?.stderr.trim()) {
    console.warn(`[ssh-system] ${sshResult.label} stderr: ${sshResult.stderr.trim()}`)
  }
}

/** What local tar says when its output, not its input, failed: the far end went away. */
const DOWNSTREAM_WRITE_FAILURE = /write error|cannot write|broken pipe|EPIPE/i

/**
 * Waits for all three, then names the cause; a failed ssh wins over a tar that succeeded. A remote
 * exit the host answered wins over a local tar failure that only followed it: tar was signalled,
 * failed after ssh closed, or reported a write/pipe error (BSD tar exits 1 with "Write error", no
 * signal). A local tar that failed on its own input first (missing directory, unreadable file) is
 * the client's fault.
 */
async function settleUploadPipeline(
  tarProcess: ChildProcess,
  local: Promise<ProcessResult>,
  remote: Promise<ProcessResult>,
  pipe: Promise<void>
): Promise<readonly [ProcessResult, ProcessResult]> {
  let settled = 0
  let localAt = 0
  let remoteAt = 0
  const stamp = <T>(promise: Promise<T>, record: (at: number) => void): Promise<T> =>
    promise.finally(() => record(++settled))
  const [tar, ssh, piped] = await Promise.allSettled([
    stamp(local, (at) => (localAt = at)),
    stamp(remote, (at) => (remoteAt = at)),
    pipe
  ])
  const remoteAnswered = ssh.status === 'rejected' && isHostAnsweredSystemSshExit(ssh.reason)
  if (tar.status === 'rejected') {
    const localFollowedRemote =
      tarProcess.signalCode !== null ||
      remoteAt < localAt ||
      (tar.reason instanceof Error && DOWNSTREAM_WRITE_FAILURE.test(tar.reason.message))
    throw remoteAnswered && localFollowedRemote ? ssh.reason : tar.reason
  }
  if (ssh.status === 'rejected') {
    throw ssh.reason
  }
  if (piped.status === 'rejected') {
    throw piped.reason
  }
  return [tar.value, ssh.value]
}

export async function writeFileViaSystemSsh(
  target: SshTarget,
  remotePath: string,
  contents: string,
  options?: SystemSshOperationOptions
): Promise<void> {
  throwIfAborted(options?.signal)
  await writeBufferViaSystemSsh(target, remotePath, Buffer.from(contents, 'utf-8'), options)
}

export type LocalUploadPlan = {
  directories: string[]
  files: { localPath: string; remotePath: string }[]
}

/**
 * #16432: this used to base64 every artifact into one JSON array and push the whole ~1.9MB string
 * into one PowerShell stdin. Base64 inflates the payload 1.33x, and Windows PowerShell 5.1 cannot
 * read a stdin that large over a non-pty ssh exec — it blocks forever instead of failing. Nothing
 * about a directory upload requires one frame: the plan carries paths only, and the bytes go per
 * file, in writes bounded by WINDOWS_STDIN_WRITE_CHUNK_BYTES.
 */
export async function collectLocalUploadPlan(
  localDir: string,
  remoteDir: string,
  hostPlatform: RemoteHostPlatform,
  signal: AbortSignal | undefined,
  plan: LocalUploadPlan = { directories: [], files: [] },
  budget = new DirectoryTransferBudget(),
  depth = 0
): Promise<LocalUploadPlan> {
  throwIfAborted(signal)
  budget.record([localDir, remoteDir], depth)
  plan.directories.push(remoteDir)
  for await (const entry of await opendir(localDir)) {
    throwIfAborted(signal)
    const localPath = pathJoin(localDir, entry.name)
    const remotePath = joinRemotePath(hostPlatform, remoteDir, entry.name)
    const statResult = await lstat(localPath)
    if (statResult.isSymbolicLink() || (!statResult.isFile() && !statResult.isDirectory())) {
      continue
    }
    if (statResult.isDirectory()) {
      await collectLocalUploadPlan(
        localPath,
        remotePath,
        hostPlatform,
        signal,
        plan,
        budget,
        depth + 1
      )
      continue
    }
    budget.record([localPath, remotePath], depth + 1)
    plan.files.push({ localPath, remotePath })
  }
  return plan
}
