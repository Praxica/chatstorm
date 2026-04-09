"use client"

import { useEffect } from 'react'
import { useDashboardStore } from '@/lib/stores/dashboardStore'
import { SpacesList } from '@/components/dashboard/SpacesList'
import DashboardLayout from '@/app/(dashboard)/layout'

export default function SpacesPage() {
  const setActiveView = useDashboardStore(state => state.setActiveView)

  useEffect(() => {
    setActiveView('spaces')
  }, [setActiveView])
  
  return (
    <DashboardLayout>
      <div className="p-6">
        <SpacesList />
      </div>
    </DashboardLayout>
  )
}