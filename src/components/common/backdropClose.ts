import type { MouseEvent } from 'react'

// ─── Selection-safe backdrop dismissal ─────────────────
// A backdrop that closes on `click` eats text selections: press inside the
// dialog, drag out, release, and the browser dispatches the click on the common
// ancestor of the press and the release — the backdrop — so the dialog closes
// mid-selection. Guarding with `e.target === e.currentTarget` does not help,
// because the backdrop genuinely IS the click target in that case.
//
// Keying dismissal off where the press STARTED fixes it: a selection drag that
// begins inside the dialog never mousedowns on the backdrop. Same semantics as
// Radix's pointer-down-outside.
//
//   <div className="fixed inset-0 …" {...backdropClose(onClose)}>
//     <div className="panel">…</div>
//   </div>
export function backdropClose(onClose: () => void): { onMouseDown: (e: MouseEvent<HTMLElement>) => void } {
  return {
    onMouseDown: (e) => {
      if (e.target === e.currentTarget) onClose()
    },
  }
}
