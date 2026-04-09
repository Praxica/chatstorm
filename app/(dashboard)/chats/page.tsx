"use client"

import { useEffect } from 'react'
import Dashboard from "@/components/dashboard/dashboard"
import { useDashboardStore } from "@/lib/stores/dashboardStore"

export default function ChatsPage() {
  const setActiveView = useDashboardStore(state => state.setActiveView)

  useEffect(() => {
    setActiveView('chats')
  }, [setActiveView])
  
  return <Dashboard />
} 