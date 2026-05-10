import { useState, useRef, useEffect } from 'react'

export default function ChatPanel({ connected }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef()
  const inputRef = useRef()

  const apiUrl = import.meta.env.VITE_API_URL || ''

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const question = input.trim()
    if (!question || streaming) return

    // Optimistic user message
    const userMsg = { role: 'user', content: question }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)
    setError(null)

    // Assistant placeholder
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let done = false

      while (!done) {
        const { done: d, value } = await reader.read()
        done = d
        if (!value) continue

        const chunk = decoder.decode(value)
        // SSE: data: {...}\n\n
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const msg = JSON.parse(line.slice(6))
            if (msg.error) {
              setError(msg.error)
              break
            }
            setMessages(prev => {
              const last = prev[prev.length - 1]
              return { ...prev, [prev.length - 1]: { ...last, content: last.content + msg.token } }
            })
            if (msg.done) break
          } catch {}
        }
      }
    } catch (e) {
      setError(e.message)
      // Remove placeholder
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setStreaming(false)
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <section className="flex-1 flex flex-col overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-[#8b949e] text-sm">Upload a document first, then ask questions about it.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[70%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#238636] text-white'
                  : 'bg-[#21262d] text-[#e6edf3]'
              }`}
            >
              {msg.content}
              {msg.role === 'assistant' && i === messages.length - 1 && streaming && (
                <span className="ml-1 inline-block w-1.5 h-3.5 bg-[#8b949e] animate-pulse rounded-sm" />
              )}
            </div>
          </div>
        ))}

        {error && (
          <div className="flex justify-start">
            <div className="bg-[#f85149]/10 border border-[#f85149]/30 text-[#f85149] text-xs rounded px-3 py-2">
              Error: {error}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="p-4 border-t border-[#30363d] bg-[#161b22]">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={connected ? 'Ask about your document…' : 'Waiting for API connection…'}
            disabled={!connected}
            rows={1}
            className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] resize-none focus:outline-none focus:border-[#58a6ff] disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!connected || !input.trim() || streaming}
            className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </section>
  )
}