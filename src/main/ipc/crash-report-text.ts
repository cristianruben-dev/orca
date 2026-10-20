import os from 'node:os'
import { app } from 'electron'
import { formatUncapturedCrashReportText } from '../../shared/crash-reporting'

export function buildUncapturedCrashReportText(notes: string | undefined): string {
  return formatUncapturedCrashReportText(
    {
      createdAt: new Date().toISOString(),
      appVersion: app.getVersion(),
      platform: os.platform(),
      osRelease: os.release(),
      arch: os.arch(),
      electronVersion: process.versions.electron ?? 'unknown',
      chromeVersion: process.versions.chrome ?? 'unknown'
    },
    notes
  )
}
