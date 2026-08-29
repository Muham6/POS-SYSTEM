import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { APP_OVERVIEW } from '@/lib/pos-knowledge'

// Free-tier Gemini model. Override with GEMINI_MODEL if you want a different one.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    // Not an error — the widget falls back to local FAQ matching when it sees this.
    return NextResponse.json({ configured: false })
  }

  const body = await req.json().catch(() => null)
  const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : []
  if (messages.length === 0) {
    return NextResponse.json({ error: 'no_messages' }, { status: 400 })
  }

  const systemPrompt = `You are a friendly, concise in-app help assistant for a point-of-sale (POS) system. Only answer questions about how to use this app — its screens, workflows, and terminology described below. Keep answers short (2-4 sentences), practical, and specific to this app. If asked something unrelated to using the app, gently redirect to app-related help.

The person you're helping is signed in as: ${profile.role}.

${APP_OVERVIEW}`

  const contents = messages.slice(-12).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content).slice(0, 2000) }],
  }))

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { maxOutputTokens: 300, temperature: 0.4 },
        }),
      }
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'upstream_error' }, { status: 502 })
    }

    const data = await res.json()
    const reply: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text

    if (!reply) {
      return NextResponse.json({ error: 'empty_reply' }, { status: 502 })
    }

    return NextResponse.json({ configured: true, reply: reply.trim() })
  } catch {
    return NextResponse.json({ error: 'request_failed' }, { status: 502 })
  }
}
