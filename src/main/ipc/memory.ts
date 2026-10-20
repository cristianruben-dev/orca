import { ipcMain } from 'electron'
import type { MemorySnapshot } from '../../shared/process-stats-types'
import type { Store } from '../persistence'
import { emptyMemorySnapshot } from '../memory/memory-snapshot-values'

export function registerMemoryHandlers(_store: Store): void {
  ipcMain.handle('memory:getSnapshot', (): Promise<MemorySnapshot> =>
    Promise.resolve(emptyMemorySnapshot())
  )
}
