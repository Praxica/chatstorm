"use client"

import { useEffect } from 'react'
import { useDashboardStore } from '@/lib/stores/dashboardStore'
import SpaceTokensTab from '@/components/spaces/SpaceTokensTab'

export default function SpaceTokensPage() {
  const setActiveView = useDashboardStore(state => state.setActiveView)

  useEffect(() => {
    setActiveView('tokens')
  }, [setActiveView])
  
  return <SpaceTokensTab />
}