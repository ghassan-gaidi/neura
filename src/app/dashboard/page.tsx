'use client'

import { Suspense } from 'react'
import DashboardContent from './DashboardContent'

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/40 text-lg">Loading dashboard...</p>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
