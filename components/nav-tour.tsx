'use client'

import { useEffect, useState } from 'react'
import { NAV_DESCRIPTIONS } from '@/lib/pos-knowledge'

type Step = { href: string; label: string }

// Remount this component (via a changing `key` from the parent) to restart the tour —
// that resets stepIndex for free instead of syncing it through an effect.
export default function NavTour({
  steps,
  storageKey,
  active,
  onFinish,
}: {
  steps: Step[]
  storageKey: string
  active: boolean
  onFinish: () => void
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!active) return

    function updateRect() {
      const step = steps[stepIndex]
      if (!step) return
      const el = document.querySelector(`[data-tour-nav="${step.href}"]`)
      setRect(el ? el.getBoundingClientRect() : null)
    }

    const id = requestAnimationFrame(updateRect)
    window.addEventListener('resize', updateRect)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', updateRect)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex])

  function finish() {
    localStorage.setItem(storageKey, '1')
    onFinish()
  }

  function next() {
    if (stepIndex >= steps.length - 1) finish()
    else setStepIndex((i) => i + 1)
  }

  if (!active || !rect) return null

  const step = steps[stepIndex]
  const description = NAV_DESCRIPTIONS[step.href] || ''
  const padding = 6
  const top = rect.top - padding
  const left = rect.left - padding
  const width = rect.width + padding * 2
  const height = rect.height + padding * 2

  const tooltipLeft = Math.max(Math.min(left + width + 12, window.innerWidth - 300), 12)
  const tooltipTop = Math.max(Math.min(top, window.innerHeight - 190), 12)

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="pointer-events-none absolute rounded-lg ring-2 ring-emerald-400 transition-all"
        style={{ top, left, width, height, boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.6)' }}
      />

      <div
        className="absolute w-72 rounded-xl bg-white p-4 shadow-2xl dark:bg-neutral-900"
        style={{ top: tooltipTop, left: tooltipLeft }}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          {stepIndex + 1} of {steps.length}
        </p>
        <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">{step.label}</p>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{description}</p>

        <div className="mt-4 flex items-center justify-between">
          <button onClick={finish} className="text-xs text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300">
            Skip tour
          </button>
          <button
            onClick={next}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
          >
            {stepIndex === steps.length - 1 ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
