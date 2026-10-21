// Why: stdin ownership is a cross-agent process contract; one executable
// matrix catches an unread early exit without duplicating template assertions.
// Exception (#11549): Windows batch hooks give up stdin ownership on the
// missing-Orca-env path, so their writer may break there.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as CodexHookHashLookup from '../codex/codex-hook-hash-lookup'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SFTPWrapper } from 'ssh2'
import type * as osModule from 'node:os'
import type * as NativeHookExecutableModule from './windows-native-hook-executable'

let isolatedUserDataDir = ''
let previousUserDataPath: string | undefined

beforeEach(() => {
  previousUserDataPath = process.env.ORCA_USER_DATA_PATH
  isolatedUserDataDir = mkdtempSync(join(tmpdir(), 'orca-hook-stdin-user-data-'))
  // Why: Orca-managed Codex hooks resolve through ORCA_USER_DATA_PATH before
  // the mocked home; an inherited live path would let this test rewrite them.
  process.env.ORCA_USER_DATA_PATH = isolatedUserDataDir
})

afterEach(() => {
  if (previousUserDataPath === undefined) {
    delete process.env.ORCA_USER_DATA_PATH
  } else {
    process.env.ORCA_USER_DATA_PATH = previousUserDataPath
  }
  rmSync(isolatedUserDataDir, { recursive: true, force: true })
})

const { homedirMock, bundledHook } = vi.hoisted(() => {
  const bundledHook: { path: string | null } = { path: null }
  return { homedirMock: vi.fn<() => string>(), bundledHook }
})

// Why: no packaged resources here; the exe leg points Claude's install at the real built binary.
vi.mock('./windows-native-hook-executable', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeHookExecutableModule>()),
  resolveBundledWindowsNativeHookExecutable: () => bundledHook.path
}))

// Why: stands in for asking a real Codex for its hook hashes, as the grant stub once did.
vi.mock('../codex/codex-hook-hash-lookup', async (importOriginal) => ({
  ...(await importOriginal<typeof CodexHookHashLookup>()),
  resolveCodexHookAnswerForLaunch: async () =>
    (await import('../codex/hook-service-test-harness')).codexHookAnswerForTests()
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/orca-user-data'
  }
}))

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof osModule>()
  return {
    ...actual,
    homedir: homedirMock.mockImplementation(actual.homedir)
  }
})

import { AntigravityHookService } from '../antigravity/hook-service'
import { ClaudeHookService } from '../claude/hook-service'
import { getRemoteManagedCommand } from '../claude/hook-settings'
import { CodexHookService } from '../codex/hook-service'
import { CommandCodeHookService } from '../command-code/hook-service'
import { CopilotHookService } from '../copilot/hook-service'
import { CursorHookService } from '../cursor/hook-service'
import { DevinHookService } from '../devin/hook-service'
import { DroidHookService } from '../droid/hook-service'
import { GeminiHookService } from '../gemini/hook-service'
import { GrokHookService } from '../grok/hook-service'
import { KimiHookService } from '../kimi/hook-service'

import { openClaudeHookService } from '../openclaude/hook-service'
import { wrapPosixHookCommand } from './installer-utils'
import {
  POSIX_HOOK_JSON_STDIN_PRELUDE,
  POSIX_HOOK_JSON_STDIN_READER,
  POSIX_HOOK_STDIN_READER
} from './hook-stdin-contract'
import { createAgentHookMemorySftp } from './agent-hook-memory-sftp.test-fixture'

const REMOTE_HOME = '/home/dev'
const LARGE_PAYLOAD = Buffer.alloc(1_000_000, 'x')

const REMOTE_INSTALLERS = [
  {
    agent: 'antigravity',
    install: (sftp: SFTPWrapper) => new AntigravityHookService().installRemote(sftp, REMOTE_HOME)
  },
  {
    agent: 'claude',
    install: (sftp: SFTPWrapper) => new ClaudeHookService().installRemote(sftp, REMOTE_HOME)
  },
  {
    agent: 'openclaude',
    install: (sftp: SFTPWrapper) => openClaudeHookService.installRemote(sftp, REMOTE_HOME)
  },
  {
    agent: 'codex',
    install: (sftp: SFTPWrapper) => new CodexHookService().installRemote(sftp, REMOTE_HOME)
  },
  {
    agent: 'command-code',
    install: (sftp: SFTPWrapper) => new CommandCodeHookService().installRemote(sftp, REMOTE_HOME)
  },
  {
    agent: 'copilot',
    install: (sftp: SFTPWrapper) => new CopilotHookService().installRemote(sftp, REMOTE_HOME)
  },
  {
    agent: 'cursor',
    install: (sftp: SFTPWrapper) => new CursorHookService().installRemote(sftp, REMOTE_HOME)
  },
  {
    agent: 'devin',
    install: (sftp: SFTPWrapper) => new DevinHookService().installRemote(sftp, REMOTE_HOME)
  },
  {
    agent: 'droid',
    install: (sftp: SFTPWrapper) => new DroidHookService().installRemote(sftp, REMOTE_HOME)
  },
  {
    agent: 'gemini',
    install: (sftp: SFTPWrapper) => new GeminiHookService().installRemote(sftp, REMOTE_HOME)
  },
  {
    agent: 'grok',
    install: (sftp: SFTPWrapper) => new GrokHookService().installRemote(sftp, REMOTE_HOME)
  },
  {
    agent: 'kimi',
    install: (sftp: SFTPWrapper) => new KimiHookService().installRemote(sftp, REMOTE_HOME)
  }
] as const

type HookRun = {
  exitCode: number | null
  stdinErrors: NodeJS.ErrnoException[]
  stderr: string
  stdout: string
}

function runHookProcess(
  executable: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  // Why: `abandon` leaves the pipe open and unwritten — the shape a caller outside an Orca
  // pane produces, and the only one that can catch a read-to-EOF that never returns (#11549).
  stdin: 'close' | 'abandon' = 'close'
): Promise<HookRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { env, stdio: ['pipe', 'pipe', 'pipe'] })
    const stdinErrors: NodeJS.ErrnoException[] = []
    let stderr = ''
    let stdout = ''
    const timeout = setTimeout(() => {
      child.stdin.destroy()
      child.kill('SIGKILL')
      reject(new Error(`hook did not finish with stdin ${stdin}d`))
    }, 10_000)
    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.stdin.on('error', (error: NodeJS.ErrnoException) => stdinErrors.push(error))
    child.on('close', (exitCode) => {
      clearTimeout(timeout)
      resolve({ exitCode, stdinErrors, stderr, stdout })
    })
    if (stdin === 'close') {
      child.stdin.end(LARGE_PAYLOAD)
    }
  })
}

function hookEnvironment(extraEnv: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('ORCA_'))
  )
  return {
    ...env,
    HOME: REMOTE_HOME,
    ORCA_AGENT_HOOK_ENDPOINT: '',
    ...extraEnv
  }
}

function runPosixHook(command: string, extraEnv: NodeJS.ProcessEnv = {}): Promise<HookRun> {
  return runHookProcess('/bin/sh', ['-c', command], hookEnvironment(extraEnv))
}

async function generatePosixScripts(): Promise<Map<string, string>> {
  const scripts = new Map<string, string>()
  for (const entry of REMOTE_INSTALLERS) {
    const memory = createAgentHookMemorySftp()
    const status = await entry.install(memory.sftp)
    expect(status.state, `${entry.agent} install status`).toBe('installed')
    const generated = [...memory.fs.files.entries()].filter(
      ([path]) => path.includes('/.orca/agent-hooks/') && path.endsWith('.sh')
    )
    // Why: Claude ships a second managed script (the statusline usage feed); the stdin lifecycle contract applies to every generated script.
    expect(generated.length, `${entry.agent} generated scripts`).toBeGreaterThan(0)
    for (const [path, script] of generated) {
      scripts.set(`${entry.agent} ${path.split('/').pop()}`, script)
    }
  }
  return scripts
}

// Why: the Codex installer is async, so the override has to stay pinned across
describe('managed hook stdin lifecycle', () => {
  it('emits neutral JSON when the Claude lifecycle script is missing', async () => {
    const command = getRemoteManagedCommand('/home/dev/.orca/agent-hooks/claude-hook.sh')
    const result = await runPosixHook(command)

    expect(result.exitCode).toBe(0)
    expect(result.stdinErrors).toHaveLength(0)
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout.trim())).toEqual({})
  })

  it('captures stdin before every possible whole-script success exit', async () => {
    const scripts = await generatePosixScripts()
    for (const [agent, script] of scripts) {
      const captureIndex = Math.max(
        script.indexOf(`payload=$(${POSIX_HOOK_STDIN_READER})`),
        script.indexOf(`payload=$(${POSIX_HOOK_JSON_STDIN_READER})`)
      )
      const firstExitIndex = script.indexOf('exit 0')
      expect(captureIndex, `${agent} payload capture`).toBeGreaterThanOrEqual(0)
      expect(firstExitIndex, `${agent} first success exit`).toBeGreaterThan(captureIndex)
      // Why: the JSON reader dereferences a variable the prelude sets, so a script
      // that carries the reader must carry its prelude above the capture line.
      if (script.includes(POSIX_HOOK_JSON_STDIN_READER)) {
        const prelude = POSIX_HOOK_JSON_STDIN_PRELUDE.join('\n')
        expect(script.indexOf(prelude), `${agent} JSON reader prelude`).toBeGreaterThanOrEqual(0)
        expect(script.indexOf(prelude), `${agent} prelude before capture`).toBeLessThan(
          captureIndex
        )
      }
    }
  })

  it('accepts a large payload without Orca environment or a broken writer', async () => {
    const scripts = await generatePosixScripts()
    for (const [agent, script] of scripts) {
      const extraEnv = agent.startsWith('command-code')
        ? {
            ORCA_AGENT_HOOK_PORT: '1',
            ORCA_AGENT_HOOK_TOKEN: 'test-token',
            ORCA_PANE_KEY: 'test-pane'
          }
        : {}
      const result = await runPosixHook(script, extraEnv)
      expect(result.exitCode, `${agent} exit code`).toBe(0)
      expect(result.stdinErrors, `${agent} stdin errors`).toHaveLength(0)
    }
  })

  it('does not need PATH to capture or drain POSIX hook stdin', async () => {
    const scripts = await generatePosixScripts()
    for (const [agent, script] of scripts) {
      const result = await runPosixHook(script, { PATH: '' })
      expect(result.exitCode, `${agent} exit code`).toBe(0)
      expect(result.stdinErrors, `${agent} stdin errors`).toHaveLength(0)
    }

    const missing = await runPosixHook(wrapPosixHookCommand('/missing/orca-hook.sh'), { PATH: '' })
    expect(missing.exitCode, 'missing script launcher exit code').toBe(0)
    expect(missing.stdinErrors, 'missing script launcher stdin errors').toHaveLength(0)
  })

  // Why: an unread stdin still exits 0, so exit codes alone cannot prove the
  // reader consumed the payload. Assert the captured byte count directly.
  it.each([
    ['empty PATH', ''],
    // Why: /bin/cat is absent on NixOS-style hosts, so an absolute path alone is
    // not enough; the reader must fall back to the shell's default PATH.
    ['PATH without coreutils', '/nonexistent'],
    // Why: a worktree-local `cat` must never receive the hook payload.
    ['PATH whose first cat is a decoy', '']
  ])('captures the whole payload with %s', async (label, pathValue) => {
    const decoyDir = mkdtempSync(join(tmpdir(), 'orca-hook-stdin-decoy-'))
    try {
      let effectivePath = pathValue
      if (label === 'PATH whose first cat is a decoy') {
        const decoy = join(decoyDir, 'cat')
        writeFileSync(decoy, '#!/bin/sh\nexit 0\n', { mode: 0o755 })
        effectivePath = decoyDir
      }
      const result = await runHookProcess(
        '/bin/sh',
        ['-c', `payload=$(${POSIX_HOOK_STDIN_READER}); printf '%s' "${'${#payload}'}"`],
        { ...hookEnvironment(), PATH: effectivePath }
      )
      expect(result.exitCode, `${label} exit code`).toBe(0)
      expect(result.stdinErrors, `${label} stdin errors`).toHaveLength(0)
      expect(result.stdout, `${label} captured bytes`).toBe(String(LARGE_PAYLOAD.length))
    } finally {
      rmSync(decoyDir, { recursive: true, force: true })
    }
  })

  it('drains before Claude skips hooks imported by Devin', async () => {
    const script = (await generatePosixScripts()).get('claude claude-hook.sh')
    expect(script).toBeDefined()
    const result = await runPosixHook(script!, { DEVIN_PROJECT_DIR: '/tmp/devin-project' })
    expect(result.exitCode).toBe(0)
    expect(result.stdinErrors).toHaveLength(0)
  })

  it('drains a large payload when the configured script is missing', async () => {
    const result = await runPosixHook(wrapPosixHookCommand('/missing/orca-hook.sh'))
    expect(result.exitCode).toBe(0)
    expect(result.stdinErrors).toHaveLength(0)
  })
})
