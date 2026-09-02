'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import { X, AlertTriangle } from 'lucide-react'

type Props = {
  onDetected: (code: string) => void
  onClose: () => void
  /** Set by the caller when the most recently scanned code didn't match any product —
   *  rendered inline so the cashier can retry without the modal closing. */
  notFoundCode?: string | null
}

type Status = 'initializing' | 'scanning' | 'error'

export default function BarcodeScanner({ onDetected, onClose, notFoundCode }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const lastCodeRef = useRef<string | null>(null)
  const lastDetectedAtRef = useRef(0)

  const cameraSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  const [status, setStatus] = useState<Status>(cameraSupported ? 'initializing' : 'error')
  const [errorMessage, setErrorMessage] = useState(
    cameraSupported
      ? ''
      : "This browser doesn't support camera access. Selling still works fine — search for the product manually, or use a physical barcode scanner (it types straight into the search box)."
  )

  useEffect(() => {
    if (!cameraSupported) return

    let cancelled = false

    const reader = new BrowserMultiFormatReader()

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, _err, controls) => {
        controlsRef.current = controls
        if (cancelled || !result) return

        const code = result.getText()
        const now = Date.now()
        // The same barcode decodes on nearly every frame while it stays in view —
        // only forward a fresh detection so we don't spam addToCart/lookups.
        if (code === lastCodeRef.current && now - lastDetectedAtRef.current < 1500) return
        lastCodeRef.current = code
        lastDetectedAtRef.current = now
        onDetected(code)
      })
      .then((controls) => {
        if (cancelled) {
          controls.stop()
          return
        }
        controlsRef.current = controls
        setStatus('scanning')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setStatus('error')
        setErrorMessage(cameraErrorMessage(err))
      })

    return () => {
      cancelled = true
      // Release the camera stream so the device's camera light turns off.
      controlsRef.current?.stop()
      controlsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClose = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    onClose()
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg dark:bg-neutral-900 dark:shadow-none">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Scan barcode</h3>
          <button
            onClick={handleClose}
            aria-label="Close scanner"
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          >
            <X size={18} />
          </button>
        </div>

        {status === 'error' ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} className="aspect-video w-full object-cover" muted autoPlay playsInline />
          </div>
        )}

        {status === 'initializing' && (
          <p className="mt-2 text-center text-xs text-neutral-400 dark:text-neutral-500">Requesting camera access…</p>
        )}
        {status === 'scanning' && (
          <p className="mt-2 text-center text-xs text-neutral-400 dark:text-neutral-500">Point the camera at a barcode.</p>
        )}

        {notFoundCode && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            No product found for barcode: <span className="font-medium">{notFoundCode}</span>
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : ''
  const fallback =
    'Selling still works fine — search for the product manually, or use a physical barcode scanner (it types straight into the search box).'

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return `Camera access was denied. ${fallback}`
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return `No camera device was found on this device. ${fallback}`
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return `The camera is unavailable right now (it may be in use by another app). ${fallback}`
  }
  return `Couldn't start the camera. ${fallback}`
}
