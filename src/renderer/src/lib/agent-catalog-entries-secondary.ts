import type { AgentCatalogEntry } from './agent-catalog'

/** Empty community catalog — only agents with rate limit metrics are supported in the catalog. */
export function secondaryAgentCatalogEntries(): AgentCatalogEntry[] {
  return []
}
