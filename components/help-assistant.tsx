'use client'

import { useRef, useState } from 'react'
import { MessageCircleQuestion, X, Send } from 'lucide-react'
import { findLocalAnswer } from '@/lib/pos-knowledge'

type Message = { role: 'user' | 'assistant'; content: string }

const SUGGESTED = [
  'How do I make a sale?',
  'How do I receive new stock?',
  'How do shifts work?',
  'What does low stock mean?',
]

const FALLBACK_ANSWER =
  "I don't have a canned answer for that yet. Try asking about selling, stock, suppliers, shifts, or settings — or check the sidebar for the relevant screen."

export default function HelpAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

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

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Help assistant"
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:bg-emerald-600 lg:bottom-6 lg:right-6"
      >
        {open ? <X size={22} /> : <MessageCircleQuestion size={22} />}
      </button>

      {open && (
        <div className="fixed inset-x-4 bottom-20 z-40 flex max-h-[70vh] flex-col rounded-xl border border-neutral-200 bg-white shadow-xl sm:inset-x-auto sm:right-6 sm:w-96 lg:bottom-24">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-800">Help</p>
            {aiConfigured === false && (
              <span className="text-[10px] uppercase tracking-wide text-neutral-400">FAQ mode</span>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div>
                <p className="text-sm text-neutral-500">Ask me anything about using this app.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SUGGESTED.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:border-emerald-400 hover:text-emerald-700"
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
                    : 'bg-neutral-100 text-neutral-800'
                }`}
              >
                {m.content}
              </div>
            ))}

            {loading && (
              <div className="max-w-[85%] rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-400">
                Thinking…
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="flex items-center gap-2 border-t border-neutral-200 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
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
