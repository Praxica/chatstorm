"use client";

import { ConfigsList } from './ConfigsList'
import { TemplatesList } from './TemplatesList'
import { useDashboardStore, type DashboardView } from '@/lib/stores/dashboardStore'
import { ChatsList } from './ChatsList'
import { SpacesList } from './SpacesList'
import SpaceTokensTab from '@/components/spaces/SpaceTokensTab'

interface DashboardProps {
  spaceId?: string; // When provided, show space dashboard
  initialView?: DashboardView; // Override the default view
}

export default function Dashboard({ spaceId, initialView }: DashboardProps) {
  const activeView = useDashboardStore(state => state.activeView)
  const setActiveView = useDashboardStore(state => state.setActiveView)

  // Use initialView if provided, otherwise use store value
  const currentView = initialView || activeView
  console.log('[Dashboard] currentView:', currentView, 'initialView:', initialView, 'activeView:', activeView)

  // Set the store to match initialView if provided
  if (initialView && activeView !== initialView) {
    setActiveView(initialView)
  }

  // Only render the active tab's content
  const renderContent = () => {
    switch (currentView) {
      case 'designs':
        return (
          <div className="p-6">
            <ConfigsList spaceId={spaceId} />
          </div>
        )
      case 'templates':
        return (
          <div className="p-6">
            <TemplatesList spaceId={spaceId} />
          </div>
        )
      case 'chats':
        return (
          <div className="p-6">
            <ChatsList spaceId={spaceId} />
          </div>
        )
      case 'spaces':
        return (
          <div className="p-6">
            <SpacesList />
          </div>
        )
      case 'tokens':
        return <SpaceTokensTab />
      default:
        return null
    }
  }

  return (
    <div className="h-full">
      {renderContent()}
    </div>
  )
} 