import type {
  WindowsMobileFirewallRepairResult,
  WindowsMobileFirewallStatus
} from '../../shared/windows-mobile-firewall'

export type WindowsMobileFirewallEnvironment = {
  platform: NodeJS.Platform
  isPackaged: boolean
  executablePath: string
}

export async function inspectWindowsMobileFirewall(
  _port: number | null,
  _address: string | undefined,
  _environment?: WindowsMobileFirewallEnvironment
): Promise<WindowsMobileFirewallStatus> {
  return { supported: false }
}

export async function repairWindowsMobileFirewall(
  _port: number | null,
  _environment?: WindowsMobileFirewallEnvironment
): Promise<WindowsMobileFirewallRepairResult> {
  return { ok: false, reason: 'unsupported' }
}

export function getWebSocketPort(endpoint: string | null): number | null {
  if (!endpoint) {
    return null
  }
  try {
    const parsed = new URL(endpoint)
    const port = Number(parsed.port)
    return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : null
  } catch {
    return null
  }
}
