import { localAiVaultScanRoots } from './cached-session-list'
import { unavailableSessionSearchStatus } from '../../shared/ai-vault-search-client'
import type { SessionSearchHostScope } from '../ai-vault-search/session-search-service'
import { fork, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import type {
  AiVaultSearchRequest,
  AiVaultSearchResponse,
  AiVaultSearchStatus
} from '../../shared/ai-vault-search-types'
import type { AiVaultListResult, AiVaultSubagentListResult } from '../../shared/ai-vault-types'
import type {
  AiVaultSessionTitleRequest,
  AiVaultSessionTitlesResult
} from '../../shared/ai-vault-session-title'
import type {
  ReadAiVaultFirstUserPromptArgs,
  ReadAiVaultFirstUserPromptResult
} from './session-first-user-prompt-read'
import { sessionSearchServiceInit } from '../ai-vault-search/session-search-service-init'
import { getSessionParseCachePersistenceOptions } from './session-parse-cache-persistence'
import { buildAiVaultServiceEnv } from './session-scanner-service-env'
import { AiVaultScannerServiceClient } from './session-scanner-service-client'
import { getAiVaultServiceEntryPath } from './session-scanner-service-entry-path'
import { lowerAiVaultServicePriority } from './session-scanner-service-priority'
import type {
  AiVaultServiceScanOptions,
  AiVaultServiceSubagentRequest,
  AiVaultSessionSearchInit
} from './session-scanner-service-protocol'
import type { LocalAiVaultScanProgressHandle } from './ai-vault-local-scan-progress'

export function spawnAiVaultServiceProcess(): ChildProcess {
  const entryPath = getAiVaultServiceEntryPath()
  if (!existsSync(entryPath)) {
    throw new Error(`AI Vault service entry not found: ${entryPath}`)
  }
  const child = fork(entryPath, [], {
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    execArgv: ['--max-old-space-size=384'],
    env: buildAiVaultServiceEnv(),
    ...(process.platform === 'win32' ? { windowsHide: true } : {})
  })
  lowerAiVaultServicePriority(child.pid)
  child.unref()
  return child
}

let sharedClient: AiVaultScannerServiceClient | null = null

export function getSharedClient(): AiVaultScannerServiceClient {
  sharedClient ??= new AiVaultScannerServiceClient({
    processFactory: spawnAiVaultServiceProcess,
    resolveSessionSearchRoots: localAiVaultScanRoots,
    init: () => ({
      sessionParseCache: getSessionParseCachePersistenceOptions(),
      sessionSearch: sessionSearchServiceInit()
    }),
    onStderr: (text) => console.error('[ai-vault-service]', text.trimEnd())
  })
  return sharedClient
}

export function scanAiVaultSessionsInService(
  _options: AiVaultServiceScanOptions,
  _signal?: AbortSignal,
  _progress?: LocalAiVaultScanProgressHandle
): Promise<AiVaultListResult> {
  return Promise.resolve({
    sessions: [],
    issues: [],
    scannedAt: new Date().toISOString()
  })
}

export function resolveAiVaultSessionTitlesInService(
  _requests: AiVaultSessionTitleRequest[],
  _signal?: AbortSignal
): Promise<AiVaultSessionTitlesResult> {
  return Promise.resolve({ titles: [] })
}

export function listAiVaultSubagentSessionsInService(
  _request: AiVaultServiceSubagentRequest,
  _signal?: AbortSignal
): Promise<AiVaultSubagentListResult> {
  return Promise.resolve({ sessions: [], issues: [] })
}

export function readAiVaultFirstUserPromptInService(
  _request: ReadAiVaultFirstUserPromptArgs,
  _signal?: AbortSignal
): Promise<ReadAiVaultFirstUserPromptResult> {
  return Promise.resolve({ prompt: null })
}

export function searchSessionsInService(
  _request: AiVaultSearchRequest,
  _hostScope?: SessionSearchHostScope
): Promise<AiVaultSearchResponse> {
  return Promise.resolve({
    kind: 'results',
    hits: [],
    page: { cursor: null, hasMore: false },
    generation: 1,
    durationMs: 0,
    truncated: { candidates: false, snippets: 0, query: false, freshness: false }
  })
}

export function sessionSearchStatusInService(): Promise<AiVaultSearchStatus> {
  return Promise.resolve(unavailableSessionSearchStatus())
}

export function reconcileSessionSearchInService(): Promise<void> {
  return Promise.resolve()
}

export function clearSessionSearchInService(): Promise<void> {
  return Promise.resolve()
}

/** Boot and every settings change: push the policy and keep a child while the index runs. */
export function updateSessionSearchInService(_init: AiVaultSessionSearchInit): void {
  // AI Vault background search service is disabled
}

export function invalidateAiVaultServiceCache(paths: string[]): Promise<void> {
  return sharedClient?.invalidate(paths) ?? Promise.resolve()
}

/** A forced refresh is a deliberate user action, so it reopens the restart circuit. */
export function clearAiVaultServiceRestartCircuit(): void {
  sharedClient?.clearRestartCircuit()
}

export function resetAiVaultScannerServiceForTests(): void {
  sharedClient?.dispose()
  sharedClient = null
}
