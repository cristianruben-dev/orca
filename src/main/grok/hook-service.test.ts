import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const { homedirMock } = vi.hoisted(() => ({
  homedirMock: vi.fn<() => string>()
}))

vi.mock('os', async () => {
  const actual = (await vi.importActual('os')) as Record<string, unknown>
  return {
    ...actual,
    homedir: homedirMock
  }
})

import { getGrokToolEventMatcherForTests, GrokHookService } from './hook-service'
import {
  POSIX_HOOK_JSON_STDIN_PRELUDE,
  POSIX_HOOK_JSON_STDIN_READER
} from '../agent-hooks/hook-stdin-contract'

const GROK_SCRIPT_FILE_NAME = process.platform === 'win32' ? 'grok-hook.cmd' : 'grok-hook.sh'
const WINDOWS_POWERSHELL_LAUNCHER =
  /^[A-Za-z]:\/[^"]*\/System32\/WindowsPowerShell\/v1\.0\/powershell\.exe -NoProfile -EncodedCommand \S+$/

// Why (#14828): Windows registers the bare script path when it is cmd-safe and only falls back
// to the encoded launcher for a profile path that is not (#6078). windows-hook-launcher-chain
// .test.ts pins which branch applies; these cases only care that Orca's hook is present.
function registersManagedGrokScript(command: string): boolean {
  return command.includes(GROK_SCRIPT_FILE_NAME) || WINDOWS_POWERSHELL_LAUNCHER.test(command)
}

describe('GrokHookService', () => {
  let homeDir: string

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'orca-grok-home-'))
    homedirMock.mockReturnValue(homeDir)
  })

  afterEach(() => {
    vi.clearAllMocks()
    rmSync(homeDir, { recursive: true, force: true })
  })

  it('installs a dedicated global Grok hook config and managed script', () => {
    const status = new GrokHookService().install()

    expect(status.state).toBe('installed')
    expect(status.configPath).toBe(join(homeDir, '.grok', 'hooks', 'orca-status.json'))
    expect(status.managedHooksPresent).toBe(true)

    const config = JSON.parse(
      readFileSync(join(homeDir, '.grok', 'hooks', 'orca-status.json'), 'utf8')
    ) as {
      hooks: Record<string, { matcher?: string; hooks: { command: string }[] }[]>
    }
    expect(Object.keys(config.hooks).sort()).toEqual(
      [
        'Notification',
        'PreToolUse',
        'PostToolUse',
        'PostToolUseFailure',
        'SessionEnd',
        'SessionStart',
        'Stop',
        'StopCancelled',
        'StopFailure',
        'UserPromptSubmit'
      ].sort()
    )
    // Why: PreToolUse drives in-flight tool state and ask_user_question waits. The pane guard below
    // keeps it inert outside Orca; PostToolUse cannot replace a state that has already ended.
    expect(config.hooks.PreToolUse[0].matcher).toBe('.*')
    expect(registersManagedGrokScript(config.hooks.PreToolUse[0].hooks[0].command)).toBe(true)
    // Why: Grok matchers are real regexes; bare `*` does not match-all.
    expect(config.hooks.PostToolUseFailure[0].matcher).toBe('.*')
    expect(config.hooks.PostToolUse[0].matcher).toBe('.*')
    // Why: cancellation/failure are lifecycle-only events and must not inherit a tool matcher.
    expect(config.hooks.StopCancelled[0].matcher).toBeUndefined()
    expect(config.hooks.StopFailure[0].matcher).toBeUndefined()
    expect(config.hooks.Notification[0].matcher).toBeUndefined()
    // Why: assert the shipped helper still matches what install wrote (regression
    // guard if GROK_TOOL_EVENT_MATCHER drifts from install).
    expect(getGrokToolEventMatcherForTests()).toBe('.*')
    expect(getGrokToolEventMatcherForTests()).not.toBe('*')
    expect(new RegExp(getGrokToolEventMatcherForTests()).test('run_terminal_command')).toBe(true)
    // Why: build the invalid pattern at runtime so static lint does not flag it.
    const bareStar = ['*', ''].join('')
    expect(() => new RegExp(bareStar)).toThrow()
    expect(registersManagedGrokScript(config.hooks.PostToolUse[0].hooks[0].command)).toBe(true)
    if (process.platform !== 'win32') {
      const command = config.hooks.PostToolUse[0].hooks[0].command
      expect(command).toContain(join(homeDir, '.orca'))
      // Why: with no Orca pane in the environment the guard short-circuits, so a standalone Grok
      // session never spawns a shell for the managed script at all.
      expect(command).toMatch(/^if \[ -n "\$\{ORCA_PANE_KEY-\}" \] && /)
    }

    const script = readFileSync(
      join(homeDir, '.orca', 'agent-hooks', GROK_SCRIPT_FILE_NAME),
      'utf8'
    )
    expect(script).toContain('/hook/grok')
    if (process.platform === 'win32') {
      expect(script).toContain('%SystemRoot%\\System32\\curl.exe')
      // Why: windows-grok-hook-script.test.ts pins the GROK_HOME guard shape itself,
      // and does so on every platform rather than only on Windows runners.
      expect(script).toContain('set "ORCA_GROK_HOME=%GROK_HOME:"=%"')
      expect(script).toContain('--data-urlencode "grokHome=%ORCA_GROK_HOME%"')
    } else {
      // Why: payload is piped to curl via stdin (`payload@-`) so it never lands
      // on the curl command line (EDR oversized-command-line false positive).
      // Why the ordering: the reader chain dereferences the prelude's variable, so a
      // prelude emitted after the capture would silently run `python -c ""` and
      // hand back an empty payload.
      const prelude = POSIX_HOOK_JSON_STDIN_PRELUDE.join('\n')
      expect(script).toContain(prelude)
      expect(script.indexOf(prelude)).toBeLessThan(
        script.indexOf(`payload=$(${POSIX_HOOK_JSON_STDIN_READER})`)
      )
      expect(script).toContain(`payload=$(${POSIX_HOOK_JSON_STDIN_READER})`)
      expect(script).toContain('printf \'%s\' "$payload" | curl')
      expect(script).toContain('--data-urlencode "payload@-"')
      expect(script).toContain('${#GROK_HOME}" -le 4096')
      expect(script).toContain('--data-urlencode "grokHome=${grok_home}"')
      expect(script).not.toContain('--data-urlencode "payload=${payload}"')
    }
  })

  // Why: #6078 — a Windows user profile path with a space used to be written
  // verbatim as the hook command, so the agent split it at the space. The
  // managed command must use an encoded launcher so the path never appears raw
  // on the cmd.exe command line.
  it.skipIf(process.platform !== 'win32')(
    'wraps the managed hook command to survive spaces in the profile path (#6078)',
    () => {
      const spaceHome = join(tmpdir(), 'orca grok home with spaces')
      mkdirSync(spaceHome, { recursive: true })
      homedirMock.mockReturnValue(spaceHome)
      try {
        expect(new GrokHookService().install().state).toBe('installed')

        const config = JSON.parse(
          readFileSync(join(spaceHome, '.grok', 'hooks', 'orca-status.json'), 'utf8')
        ) as { hooks: Record<string, { hooks: { command: string }[] }[]> }

        for (const eventName of ['SessionStart', 'UserPromptSubmit', 'Stop']) {
          const command = config.hooks[eventName]?.[0]?.hooks?.[0]?.command
          expect(command).toMatch(WINDOWS_POWERSHELL_LAUNCHER)
        }
      } finally {
        rmSync(spaceHome, { recursive: true, force: true })
      }
    }
  )

  it('installs hooks under GROK_HOME when set', () => {
    const grokHome = mkdtempSync(join(tmpdir(), 'orca-grok-home-env-'))
    const previous = process.env.GROK_HOME
    process.env.GROK_HOME = grokHome
    try {
      const status = new GrokHookService().install()
      expect(status.state).toBe('installed')
      expect(status.configPath).toBe(join(grokHome, 'hooks', 'orca-status.json'))
      expect(readFileSync(join(grokHome, 'hooks', 'orca-status.json'), 'utf8')).toContain(
        'SessionStart'
      )
      // Why: must not also write into the mocked ~/.grok when GROK_HOME wins.
      expect(() =>
        readFileSync(join(homeDir, '.grok', 'hooks', 'orca-status.json'), 'utf8')
      ).toThrow()
    } finally {
      if (previous === undefined) {
        delete process.env.GROK_HOME
      } else {
        process.env.GROK_HOME = previous
      }
      rmSync(grokHome, { recursive: true, force: true })
    }
  })

  it('does not restore a user-cleared global hook config on the next launch', () => {
    const service = new GrokHookService()
    const configPath = join(homeDir, '.grok', 'hooks', 'orca-status.json')
    const userClearedConfig = '{  "hooks" : {}  }\n'

    expect(service.install().state).toBe('installed')
    writeFileSync(configPath, userClearedConfig, 'utf8')

    service.install()

    expect(readFileSync(configPath, 'utf8')).toBe(userClearedConfig)
  })

  it('preserves a user-cleared config during session cleanup', () => {
    const service = new GrokHookService()
    const configPath = join(homeDir, '.grok', 'hooks', 'orca-status.json')
    const userClearedConfig = '{  "hooks" : {}  }\n'

    expect(service.install().state).toBe('installed')
    writeFileSync(configPath, userClearedConfig, 'utf8')

    expect(service.remove().state).toBe('not_installed')
    expect(readFileSync(configPath, 'utf8')).toBe(userClearedConfig)
  })

  it('removes the empty managed config when hooks are disabled', () => {
    const service = new GrokHookService()
    const configPath = join(homeDir, '.grok', 'hooks', 'orca-status.json')

    service.install()
    expect(service.remove().state).toBe('not_installed')
    expect(() => readFileSync(configPath, 'utf8')).toThrow()
  })

  // Why: remove() used to unlink only when the whole config object was empty, so any non-hook key
  // left a remnant behind — and install()'s user-cleared guard then read that remnant as a
  // deliberate opt-out and never reinstalled again.
  it('removes the managed config even when a non-hook key remains', () => {
    const service = new GrokHookService()
    const configPath = join(homeDir, '.grok', 'hooks', 'orca-status.json')

    expect(service.install().state).toBe('installed')
    const withSchema = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>
    withSchema.$schema = 'https://grok.example/hooks.schema.json'
    writeFileSync(configPath, `${JSON.stringify(withSchema, null, 2)}\n`, 'utf8')

    expect(service.remove().state).toBe('not_installed')

    expect(existsSync(configPath)).toBe(false)
    expect(service.install().state).toBe('installed')
  })

  // Why: the reported workaround for #15518 was emptying this file by hand, so Orca must not
  // rewrite it on startup. But then turning the setting back on has to work, or the toggle
  // silently lies and the only way back is deleting a file in a hidden directory.
  it('leaves a user-cleared config alone on a startup install', () => {
    const service = new GrokHookService()
    const configPath = join(homeDir, '.grok', 'hooks', 'orca-status.json')
    const userCleared = '{  "hooks" : {}  }\n'

    expect(service.install().state).toBe('installed')
    writeFileSync(configPath, userCleared, 'utf8')

    service.install()

    expect(readFileSync(configPath, 'utf8')).toBe(userCleared)
  })

  it('restores a user-cleared config when the user turns hooks back on', () => {
    const service = new GrokHookService()
    const configPath = join(homeDir, '.grok', 'hooks', 'orca-status.json')
    const userCleared = '{  "hooks" : {}  }\n'

    expect(service.install().state).toBe('installed')
    writeFileSync(configPath, userCleared, 'utf8')

    expect(service.install({ userInitiated: true }).state).toBe('installed')

    expect(readFileSync(configPath, 'utf8')).not.toBe(userCleared)
    expect(service.getStatus().managedHooksPresent).toBe(true)
  })

  // Why: hook-config-write-path.ts exists because users symlink these configs into dotfiles repos.
  // Unlinking or renaming onto the link path destroys that link and silently detaches the file they
  // version-control. Their file is theirs -- strip our entries and write through it.
  it('writes through a symlinked config instead of destroying the link', async () => {
    const service = new GrokHookService()
    const configPath = join(homeDir, '.grok', 'hooks', 'orca-status.json')
    const realConfig = join(homeDir, 'dotfiles', 'orca-status.json')

    expect(service.install().state).toBe('installed')
    mkdirSync(dirname(realConfig), { recursive: true })
    renameSync(configPath, realConfig)
    symlinkSync(realConfig, configPath)

    await service.removeAsync()

    expect(lstatSync(configPath).isSymbolicLink()).toBe(true)
    expect(existsSync(realConfig)).toBe(true)
    expect(service.getStatus().managedHooksPresent).toBe(false)
  })

  it('respects an empty user-managed symlink as an opt-out', () => {
    const service = new GrokHookService()
    const configPath = join(homeDir, '.grok', 'hooks', 'orca-status.json')
    const realConfig = join(homeDir, 'dotfiles', 'orca-status.json')
    const userCleared = '{"hooks":{}}\n'
    mkdirSync(dirname(configPath), { recursive: true })
    mkdirSync(dirname(realConfig), { recursive: true })
    writeFileSync(realConfig, userCleared)
    symlinkSync(realConfig, configPath)

    expect(service.install().state).toBe('not_installed')
    expect(readFileSync(realConfig, 'utf8')).toBe(userCleared)
    expect(lstatSync(configPath).isSymbolicLink()).toBe(true)
  })

  it('writes through a symlinked config on the sync remove path too', () => {
    const service = new GrokHookService()
    const configPath = join(homeDir, '.grok', 'hooks', 'orca-status.json')
    const realConfig = join(homeDir, 'dotfiles', 'orca-status.json')

    expect(service.install().state).toBe('installed')
    mkdirSync(dirname(realConfig), { recursive: true })
    renameSync(configPath, realConfig)
    symlinkSync(realConfig, configPath)

    expect(service.remove().state).toBe('not_installed')

    expect(lstatSync(configPath).isSymbolicLink()).toBe(true)
    expect(existsSync(realConfig)).toBe(true)
    expect(service.getStatus().managedHooksPresent).toBe(false)
  })

  // Why: a symlinked config is written THROUGH on removal rather than unlinked, so after a quit it
  // is an empty file WE emptied -- byte-identical to one a user cleared. Letting the user-cleared
  // heuristic see it meant a symlinked config was silently never reinstalled after the first quit.
  it('reinstalls into a symlinked config on the launch after a quit', async () => {
    const service = new GrokHookService()
    const configPath = join(homeDir, '.grok', 'hooks', 'orca-status.json')
    const realConfig = join(homeDir, 'dotfiles', 'orca-status.json')

    expect(service.install().state).toBe('installed')
    mkdirSync(dirname(realConfig), { recursive: true })
    renameSync(configPath, realConfig)
    symlinkSync(realConfig, configPath)
    await service.removeAsync()
    expect(service.getStatus().managedHooksPresent).toBe(false)

    expect(new GrokHookService().install().state).toBe('installed')

    expect(lstatSync(configPath).isSymbolicLink()).toBe(true)
    expect(existsSync(realConfig)).toBe(true)
    expect(service.getStatus().managedHooksPresent).toBe(true)
  })

  it('preserves user-authored hook entries in the Orca Grok config file', () => {
    const configPath = join(homeDir, '.grok', 'hooks', 'orca-status.json')
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(
      configPath,
      `${JSON.stringify(
        {
          hooks: {
            Notification: [
              {
                hooks: [{ type: 'command', command: '/usr/local/bin/user-hook' }]
              }
            ]
          }
        },
        null,
        2
      )}\n`
    )

    new GrokHookService().install()

    const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
      hooks: Record<string, { hooks: { command: string }[] }[]>
    }
    const commands = config.hooks.Notification.flatMap((definition) =>
      definition.hooks.map((hook) => hook.command)
    )
    expect(commands).toContain('/usr/local/bin/user-hook')
    expect(commands.some(registersManagedGrokScript)).toBe(true)
  })
})
