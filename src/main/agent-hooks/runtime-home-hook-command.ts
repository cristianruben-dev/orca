import { CLAUDE_HOOK_PARENT_CAPTURE } from './hook-process-capture'
import { POSIX_HOOK_STDIN_DRAIN_COMMAND } from './hook-stdin-contract'

const MANAGED_SCRIPT_BASE_NAME = /^[A-Za-z0-9_-]+$/

function assertManagedScriptBaseName(scriptBaseName: string): void {
  if (!MANAGED_SCRIPT_BASE_NAME.test(scriptBaseName)) {
    throw new Error(`Invalid managed script base name: ${scriptBaseName}`)
  }
}

function buildPosixBranch(
  scriptBaseName: string,
  missingScriptFallback: string,
  options: { requireHome?: boolean } = {}
): string {
  const posixScript = `"\${HOME-}/.orca/agent-hooks/${scriptBaseName}.sh"`
  const homeGuard = options.requireHome ? '[ -n "${HOME-}" ] && ' : ''
  const parentCapture =
    scriptBaseName === 'claude-hook' || scriptBaseName === 'openclaude-hook'
      ? CLAUDE_HOOK_PARENT_CAPTURE
      : ''
  return `if ${homeGuard}[ -f ${posixScript} ] && [ -r ${posixScript} ] && [ -x ${posixScript} ]; then ${parentCapture}/bin/sh ${posixScript}; else ${missingScriptFallback}; fi`
}

/** The POSIX branch of wrapRuntimeHomeHookCommand alone, for hosts known to be POSIX. */
export function wrapRuntimeHomePosixHookCommand(scriptBaseName: string): string {
  assertManagedScriptBaseName(scriptBaseName)
  return buildPosixBranch(scriptBaseName, POSIX_HOOK_STDIN_DRAIN_COMMAND, { requireHome: true })
}

export function wrapRuntimeHomeHookCommand(
  scriptBaseName: string,
  options: { neutralJsonWhenMissing?: boolean } = {}
): string {
  assertManagedScriptBaseName(scriptBaseName)
  const drain = POSIX_HOOK_STDIN_DRAIN_COMMAND
  const neutralJson = options.neutralJsonWhenMissing ? `printf '{}\\n'` : ''
  const posixMissingScriptFallback = neutralJson ? `${drain}; ${neutralJson}` : drain
  return buildPosixBranch(scriptBaseName, posixMissingScriptFallback)
}
