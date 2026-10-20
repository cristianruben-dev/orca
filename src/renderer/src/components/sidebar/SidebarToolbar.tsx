import React from 'react'
import { useTranslation } from 'react-i18next'
import { SidebarSettingsHelpMenu } from './SidebarSettingsHelpMenu'

const SidebarToolbar = React.memo(function SidebarToolbar() {
  useTranslation()

  return (
    <div className="mt-auto shrink-0">
      <div className="flex items-center justify-between border-t border-worktree-sidebar-border px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-1">
          <SidebarSettingsHelpMenu />
        </div>
      </div>
    </div>
  )
})

export default SidebarToolbar
