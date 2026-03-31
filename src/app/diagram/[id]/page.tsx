'use client'

import { use } from 'react'
import dynamic from 'next/dynamic'

const DiagramCanvas = dynamic(
  () => import('@/components/diagram/DiagramCanvas'),
  { ssr: false }
)

export default function DiagramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  return (
    <div className="fixed inset-0 bg-[#151E2E]">
      <DiagramCanvas diagramId={id} />
    </div>
  )
}
