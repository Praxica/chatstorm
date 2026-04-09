"use client"

import { useEffect } from 'react'
import Dashboard from "@/components/dashboard/dashboard"
import { useDashboardStore } from '@/lib/stores/dashboardStore'
import { useSpace } from '@/lib/contexts/SpaceContext'

export default function SpaceChatsPage() {
  const setActiveView = useDashboardStore(state => state.setActiveView)
  const { space } = useSpace()

  useEffect(() => {
    setActiveView('chats')
  }, [setActiveView])
  
  return <Dashboard spaceId={space?.id} />
}