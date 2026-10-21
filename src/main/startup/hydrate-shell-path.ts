import type { SpawnedProcess } from '@orca/process-host/process-spec'
import { delimiter } from 'node:path'
import { spawnProcess } from '@orca/process-host'
import type { ShellHydrationFailureReason } from '../../shared/shell-path-hydration-types'
import { SHELL_PATH_DELIMITER as DELIMITER, shellPathProbe } from './shell-path-probe'

// Why: GUI-launched Electron can miss PATH entries added by shell profiles.
// Tools installed into ~/.opencode/bin, ~/.cargo/bin, pyenv/volta/fnm
// shims, and countless other user-local locations end up invisible to our
// `which` probe even though they work fine from Terminal (see stablyai/orca#829).
//
// Probe the profile-loading shell once instead of hard-coding every tool's install path.

// Why 10s: 5s was chosen without measurement and a real profile overruns it —
// a bash -ilc loading nvm, rvm, conda and gcloud measures ~1s idle but 6-7s on a
// loaded machine, so a cold start under load silently fell back to the seeded
// PATH. Mirrors the budget mature GUI editors settled on for the same probe.
//
// The tail this lengthens is not uniform. On posix the probe is fire-and-forget
// (index.ts) and only agent detection awaits it. On packaged Windows it also
// gates terminal runtime services and every non-WSL git command, so the extra
// 5s binds there — but only for a profile that already blew the old budget, and
// those users were otherwise stuck with a wrong PATH for the whole session.
const SPAWN_TIMEOUT_MS = 10_000

// ANSI escape sequences can leak into the captured output when the user's rc
// files print banners or set colored prompts. Strip them before parsing.
const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]/g // eslint-disable-line no-control-regex

// Why: the discriminator lets telemetry classify *why* hydration failed, not
// just whether it did. Five resolve sites in this file each tag the result
// with the right reason. The shared alias keeps the enum in lockstep with the
// telemetry schema (compile-time guard in telemetry-events.ts).
export type HydrationResult =
  | { ok: true; segments: string[]; failureReason: 'none' }
  | {
      ok: false
      segments: []
      failureReason: Exclude<ShellHydrationFailureReason, 'none'>
    }

let cached: Promise<HydrationResult> | null = null
let probeQueue = Promise.resolve()
// Why: patchPackagedProcessPath seeds a version-manager install dir ahead of
// PATH. nvm's startup `use` honors whatever node is already on PATH over the
// user's `default` alias, so a probe inheriting that seed comes back pinned to
// the seeded version rather than reporting what the user's shell really
// resolves. The seed now prefers the `default` alias, but still falls back to
// newest-first when default resolution yields nothing (no alias, `system`,
// uninstalled target, cycle), so the probe must stay insulated from it.
// Snapshot PATH here instead: module init runs while the import graph is
// evaluated, strictly before any statement in main's body, so it cannot observe the
// seeds — and unlike an explicit hand-off from the seeding site, there is no call
// ordering left for a later refactor to break. Windows keys it `Path`, and a Git Bash
// user whose nvm uses the POSIX ~/.nvm/versions/node layout is seeded there too, so
// capture the key alongside the value.
const LAUNCH_PATH_KEY = 'PATH'
const LAUNCH_PATH = process.env[LAUNCH_PATH_KEY] ?? null
// Why: rc files that exec into a multiplexer or start a heavy prompt can outrun the
// probe budget. This lets them detect the probe and take a fast path.
export const PROBE_MARKER_ENV_VAR = 'ORCA_SHELL_PATH_PROBE'
let launchPathOverride: { key: string; value: string } | null = null

/** @internal - tests need a clean hydration cache between cases. */
export function _resetHydrateShellPathCache(): void {
  cached = null
  probeQueue = Promise.resolve()
  launchPathOverride = null
}

export function resolveProfileLoadingShell(): string | null {
  const shell = process.env.SHELL
  return shell?.length ? shell : process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash'
}

export const resolveProfileLoadingFallbackShell = (): string | null => null

function parseCapturedPath(stdout: string, pathDelimiter: string = delimiter): string[] {
  const cleaned = stdout.replace(ANSI_RE, '')
  const first = cleaned.indexOf(DELIMITER)
  if (first === -1) {
    return []
  }
  const second = cleaned.indexOf(DELIMITER, first + DELIMITER.length)
  if (second === -1) {
    return []
  }
  const value = cleaned.slice(first + DELIMITER.length, second).trim()
  if (!value) {
    return []
  }
  // Why: Set preserves insertion order, and PATH resolution is first-match-wins,
  // so de-duping this way keeps the user's rc-file ordering intact.
  return [
    ...new Set(
      value
        .split(pathDelimiter)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  ]
}

/** @internal - tests need a launch PATH the runner's own environment cannot supply. */
export function _setLaunchPathForTests(value: string, key = 'PATH'): void {
  launchPathOverride = { key, value }
}

function isLaunchPathKey(name: string, key: string): boolean {
  return process.platform === 'win32' ? name.toLowerCase() === key.toLowerCase() : name === key
}

function applyLaunchPath(env: NodeJS.ProcessEnv, key: string, value: string | null): void {
  if (value === null) {
    return
  }
  // Why: Windows resolves env names case-insensitively even though a spread is
  // a plain object, so never leave both the captured key and another casing.
  for (const name of Object.keys(env)) {
    if (name !== key && isLaunchPathKey(name, key)) {
      delete env[name]
    }
  }
  env[key] = value
}

function shellProbeEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, [PROBE_MARKER_ENV_VAR]: '1' }
  const key = launchPathOverride?.key ?? LAUNCH_PATH_KEY
  const value = launchPathOverride?.value ?? LAUNCH_PATH
  applyLaunchPath(env, key, value)
  return env
}

/** Run a synchronous launcher without passing Orca's seeded PATH to its child. */
export function runWithLaunchPath<T>(action: () => T): T {
  const key = launchPathOverride?.key ?? LAUNCH_PATH_KEY
  const value = launchPathOverride?.value ?? LAUNCH_PATH
  if (value === null) {
    return action()
  }
  const previous = Object.entries(process.env).filter(([name]) => isLaunchPathKey(name, key))
  applyLaunchPath(process.env, key, value)
  try {
    return action()
  } finally {
    for (const name of Object.keys(process.env)) {
      if (isLaunchPathKey(name, key)) {
        delete process.env[name]
      }
    }
    for (const [name, previousValue] of previous) {
      process.env[name] = previousValue
    }
  }
}

/** Capture the login PATH without profile banners. */
function spawnShellAndReadPath(shell: string): Promise<HydrationResult> {
  return new Promise((resolve) => {
    // Why: delimiters isolate PATH from profile banners and MOTDs.
    const probe = shellPathProbe(shell)
    let finished = false
    let stdout = ''
    let timer: ReturnType<typeof setTimeout> | null = null

    let child: SpawnedProcess
    try {
      child = spawnProcess({
        program: shell,
        args: probe.args,
        // Why: inherit current env so the shell sees the same baseline, then let
        // it layer its own rc files on top. Do NOT forward stdio — some shells
        // (oh-my-zsh setups, powerlevel10k) print a lot to stderr on startup,
        // and we don't want that in Orca's console.
        env: shellProbeEnv(),
        stdio: ['ignore', 'pipe', 'ignore'],
        detached: false
      })
    } catch {
      // Why: a synchronous throw (EPERM from a Store pwsh.exe) must reach the fallback shell.
      resolve({ segments: [], ok: false, failureReason: 'spawn_error' })
      return
    }

    const cleanup = (): void => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      child.stdout?.off('data', onStdoutData)
      child.off('error', onError)
      child.off('close', onClose)
    }
    const finish = (result: HydrationResult): void => {
      if (finished) {
        return
      }
      finished = true
      cleanup()
      resolve(result)
    }

    timer = setTimeout(() => {
      // Why: slow rc files (corporate env setup, nvm eager init) can exceed
      // our budget. Kill the shell and fall back to process.env rather than
      // blocking the Agents pane indefinitely.
      try {
        child.kill('SIGKILL')
      } catch {
        // ignore
      }
      finish({ segments: [], ok: false, failureReason: 'timeout' })
    }, SPAWN_TIMEOUT_MS)

    const onStdoutData = (chunk: Buffer): void => {
      stdout += chunk.toString('utf8')
    }

    const onError = (): void => {
      finish({ segments: [], ok: false, failureReason: 'spawn_error' })
    }

    const onClose = (): void => {
      const segments = parseCapturedPath(stdout, probe.pathDelimiter)
      if (segments.length === 0) {
        finish({ segments: [], ok: false, failureReason: 'empty_path' })
        return
      }
      finish({ segments, ok: true, failureReason: 'none' })
    }

    child.stdout?.on('data', onStdoutData)
    child.on('error', onError)
    child.on('close', onClose)
  })
}

type HydrateOptions = {
  force?: boolean
  /** Override for tests — defaults to running `spawn` against the real shell. */
  spawner?: (shell: string) => Promise<HydrationResult>
  /** Override for tests — defaults to `pickShell()`. */
  shellOverride?: string | null
}

/**
 * Spawn the user's profile-loading shell once and return the PATH it would export.
 * Caches the promise for the lifetime of the process — call
 * `_resetHydrateShellPathCache()` in tests or `hydrateShellPath({ force: true })`
 * when the user asks to re-probe (e.g. after installing a new CLI).
 */
export function hydrateShellPath(options: HydrateOptions = {}): Promise<HydrationResult> {
  if (cached && !options.force) {
    return cached
  }
  const shell =
    options.shellOverride !== undefined ? options.shellOverride : resolveProfileLoadingShell()
  if (!shell) {
    cached = Promise.resolve({ segments: [], ok: false, failureReason: 'no_shell' })
    return cached
  }
  const spawner = options.spawner ?? spawnShellAndReadPath
  const probe = probeQueue.then(async () => {
    return spawner(shell)
  })
  // Why: one rejected profile must not block later refreshes or shell changes.
  probeQueue = probe.then(
    () => undefined,
    () => undefined
  )
  cached = probe
  // Why: a cached rejection would fail every later caller without re-probing.
  probe.catch(() => {
    if (cached === probe) {
      cached = null
    }
  })
  return probe
}

export function configureWindowsShellPathHydration(
  _shell?: string | null,
  _gitBashPath?: string | null,
  _fallbackShell?: string | null
): void {}

function uniquePathSegments(segments: string[]): string[] {
  const seen = new Set<string>()
  return segments.filter((segment) => {
    if (seen.has(segment)) {
      return false
    }
    seen.add(segment)
    return true
  })
}

/**
 * Promote shell-discovered PATH segments to the front of process.env.PATH,
 * preserving shell ordering and avoiding duplicates. Returns the segments that
 * were newly added so callers can log/telemetry on nontrivial hydrations.
 */
export function mergePathSegments(segments: string[]): string[] {
  if (segments.length === 0) {
    return []
  }
  const current = process.env.PATH ?? ''
  const currentSegments = current.split(delimiter).filter(Boolean)
  const shellSegments = uniquePathSegments(segments)
  const shellSegmentSet = new Set(shellSegments)
  const existing = new Set(currentSegments)
  const added = shellSegments.filter((segment) => !existing.has(segment))
  const merged = [
    ...shellSegments,
    ...currentSegments.filter((segment) => !shellSegmentSet.has(segment))
  ]
  const next = merged.join(delimiter)
  if (next === current) {
    return []
  }
  process.env.PATH = next
  return added
}
