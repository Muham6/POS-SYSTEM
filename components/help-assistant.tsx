'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircleQuestion, X, Send } from 'lucide-react'
import { findLocalAnswer } from '@/lib/pos-knowledge'

type Message = { role: 'user' | 'assistant'; content: string }
type Point = { x: number; y: number }

const SUGGESTED = [
  'How do I make a sale?',
  'How do I receive new stock?',
  'How do shifts work?',
  'What does low stock mean?',
]

const FALLBACK_ANSWER =
  "I don't have a canned answer for that yet. Try asking about selling, stock, suppliers, shifts, or settings — or check the sidebar for the relevant screen."

const BUTTON_SIZE = 48
const MARGIN = 16
const DRAG_THRESHOLD = 6
const STORAGE_KEY = 'pos_help_button_pos'
const PANEL_WIDTH = 384
const PANEL_HEIGHT = 420
const PANEL_GAP = 12
const MOBILE_BREAKPOINT = 640

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

export default function HelpAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Draggable button position. Starts null (matches SSR) and is set from
  // localStorage — or the bottom-right corner as a default — after mount.
  const [pos, setPos] = useState<Point | null>(null)
  const posRef = useRef<Point | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(
    null
  )
  const justDraggedRef = useRef(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      let initial: Point | null = null
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) initial = JSON.parse(saved)
      } catch {
        initial = null
      }
      if (!initial) {
        initial = { x: window.innerWidth - BUTTON_SIZE - MARGIN, y: window.innerHeight - BUTTON_SIZE - MARGIN }
      }
      posRef.current = initial
      setPos(initial)
    })

    function handleResize() {
      setPos((p) => {
        if (!p) return p
        const next = {
          x: clamp(p.x, MARGIN, window.innerWidth - BUTTON_SIZE - MARGIN),
          y: clamp(p.y, MARGIN, window.innerHeight - BUTTON_SIZE - MARGIN),
        }
        posRef.current = next
        return next
      })
    }
    window.addEventListener('resize', handleResize)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!posRef.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: posRef.current.x,
      originY: posRef.current.y,
      moved: false,
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) drag.moved = true
    if (!drag.moved) return

    const next = {
      x: clamp(drag.originX + dx, MARGIN, window.innerWidth - BUTTON_SIZE - MARGIN),
      y: clamp(drag.originY + dy, MARGIN, window.innerHeight - BUTTON_SIZE - MARGIN),
    }
    posRef.current = next
    setPos(next)
  }

  function handlePointerUp() {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (drag.moved) {
      justDraggedRef.current = true
      try {
        if (posRef.current) localStorage.setItem(STORAGE_KEY, JSON.stringify(posRef.current))
      } catch {
        // localStorage unavailable — position just won't persist across reloads.
      }
    }
  }

  function handleClick() {
    if (justDraggedRef.current) {
      justDraggedRef.current = false
      return
    }
    setOpen((v) => !v)
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    })
  }

  async function send(text: string) {
    const question = text.trim()
    if (!question || loading) return

    const next: Message[] = [...messages, { role: 'user', content: question }]
    setMessages(next)
    setInput('')
    setLoading(true)
    scrollToBottom()

    // Skip the network call entirely once we know there's no AI key configured.
    if (aiConfigured === false) {
      const answer = findLocalAnswer(question) || FALLBACK_ANSWER
      setMessages([...next, { role: 'assistant', content: answer }])
      setLoading(false)
      scrollToBottom()
      return
    }

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json()

      if (data.configured === false) {
        setAiConfigured(false)
        const answer = findLocalAnswer(question) || FALLBACK_ANSWER
        setMessages([...next, { role: 'assistant', content: answer }])
      } else if (data.reply) {
        setAiConfigured(true)
        setMessages([...next, { role: 'assistant', content: data.reply }])
      } else {
        const answer = findLocalAnswer(question) || FALLBACK_ANSWER
        setMessages([...next, { role: 'assistant', content: answer }])
      }
    } catch {
      const answer = findLocalAnswer(question) || FALLBACK_ANSWER
      setMessages([...next, { role: 'assistant', content: answer }])
    }

    setLoading(false)
    scrollToBottom()
  }

  // On desktop, anchor the panel near wherever the button currently is.
  // On narrow screens, ignore button position and use a full-width bottom sheet.
  const panelStyle = (() => {
    if (typeof window === 'undefined' || !pos) return undefined
    if (window.innerWidth < MOBILE_BREAKPOINT) return undefined

    const openToLeft = pos.x + BUTTON_SIZE / 2 > window.innerWidth / 2
    const openUpward = pos.y + BUTTON_SIZE / 2 > window.innerHeight / 2

    const left = openToLeft
      ? clamp(pos.x + BUTTON_SIZE - PANEL_WIDTH, MARGIN, window.innerWidth - PANEL_WIDTH - MARGIN)
      : clamp(pos.x, MARGIN, window.innerWidth - PANEL_WIDTH - MARGIN)
    const top = openUpward
      ? clamp(pos.y - PANEL_GAP - PANEL_HEIGHT, MARGIN, window.innerHeight - PANEL_HEIGHT - MARGIN)
      : clamp(pos.y + BUTTON_SIZE + PANEL_GAP, MARGIN, window.innerHeight - PANEL_HEIGHT - MARGIN)

    return { left, top, width: PANEL_WIDTH }
  })()

  return (
    <>
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        aria-label="Help assistant"
        style={{ ...(pos ? { left: pos.x, top: pos.y } : {}), touchAction: 'none' }}
        className={`fixed z-40 flex h-12 w-12 select-none items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-colors hover:bg-emerald-600 active:cursor-grabbing ${
          pos ? 'cursor-grab' : 'bottom-4 right-4 lg:bottom-6 lg:right-6'
        }`}
      >
        {open ? <X size={22} /> : <MessageCircleQuestion size={22} />}
      </button>

      {open && (
        <div
          style={panelStyle}
          className={`fixed z-50 flex max-h-[70vh] flex-col rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900 ${
            panelStyle ? '' : 'inset-x-4 bottom-20 sm:inset-x-auto sm:right-6 sm:w-96 lg:bottom-24'
          }`}
        >
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Help</p>
              {aiConfigured === false && (
                <span className="text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">FAQ mode</span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close help"
              className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            >
              <X size={16} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {aiConfigured === false
                    ? "Ask about selling, stock, shifts, suppliers, or settings — I'm running in offline FAQ mode (no AI key set up), so I match your question against a short list of built-in answers rather than understanding free-form questions."
                    : 'Ask me anything about using this app.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SUGGESTED.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-emerald-300"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'ml-auto bg-emerald-500 text-white'
                    : 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200'
                }`}
              >
                {m.content}
              </div>
            ))}

            {loading && (
              <div className="max-w-[85%] rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
                Thinking…
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="flex items-center gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white disabled:opacity-40"
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
