"use client"

import Dashboard from "@/components/dashboard/dashboard"
import { useSpace } from '@/lib/contexts/SpaceContext'

export default function SpaceDashboardPage() {
  const { space } = useSpace()

  return <Dashboard spaceId={space?.id} initialView="designs" />
}