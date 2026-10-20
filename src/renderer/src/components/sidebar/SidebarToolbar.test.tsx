// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SidebarToolbar from './SidebarToolbar'

vi.mock('./SidebarSettingsHelpMenu', () => ({
  SidebarSettingsHelpMenu: () => <button type="button">Settings</button>
}))

const roots: Root[] = []

async function renderToolbar(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)

  await act(async () => {
    root.render(<SidebarToolbar />)
  })

  return container
}

describe('SidebarToolbar', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    roots.splice(0).forEach((root) => {
      act(() => root.unmount())
    })
    document.body.replaceChildren()
    vi.clearAllMocks()
  })

  it('renders settings menu and omits workspace board and reveal buttons', async () => {
    const container = await renderToolbar()
    expect(container.textContent).toContain('Settings')
    expect(container.querySelector('button[aria-label="Workspace board"]')).toBeNull()
    expect(container.querySelector('button[aria-label="Reveal active workspace"]')).toBeNull()
  })
})
