import type { StartupCommandDelivery } from '../codex-startup-delivery'
import type { SleepingAgentLaunchConfig } from '../agent-session-resume'
import type { SetupRunnerShell } from '../setup-runner-command'
import type { OrcaDefaultTabTemplate } from '../orca-yaml-hook-types'
import type { TuiAgent } from '../tui-agent'

export type WorktreeSetupLaunch = {
  runnerScriptPath: string
  envVars: Record<string, string>
  shell?: SetupRunnerShell
  command?: string
  waitForAgentStartup?: boolean
}

export type WorktreeStartupLaunch = {
  command: string
  env?: Record<string, string>
  launchConfig?: SleepingAgentLaunchConfig
  launchToken?: string
  launchAgent?: TuiAgent
  viewMode?: 'terminal' | 'chat'
  startupCommandDelivery?: StartupCommandDelivery
}

export type WorktreeDefaultTabsLaunch = {
  tabs: OrcaDefaultTabTemplate[]
  runCommands: boolean
}
