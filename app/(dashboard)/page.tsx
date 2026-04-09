"use client"

import { useEffect } from 'react'
import { SignedIn, SignedOut } from '@clerk/nextjs'
import { LandingPage } from '@/components/landing/LandingPage'
import Dashboard from "@/components/dashboard/dashboard"
import { useDashboardStore } from '@/lib/stores/dashboardStore'

export default function RootPage() {
  const setActiveView = useDashboardStore(state => state.setActiveView)

  useEffect(() => {
    setActiveView('designs')
  }, [setActiveView])
  
  return (
    <>
      <SignedOut>
        <LandingPage />
      </SignedOut>
      <SignedIn>
        <Dashboard />
      </SignedIn>
    </>
  )
} 